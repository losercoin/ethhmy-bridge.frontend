import { StoreConstructor } from '../core/StoreConstructor';
import { action, autorun, computed, observable } from 'mobx';
import { statusFetching } from '../../constants';
import {
  ACTION_TYPE,
  EXCHANGE_MODE,
  IOperation,
  NETWORK_TYPE,
  STATUS,
  TConfig,
  TFullConfig,
  TOKEN,
} from '../interfaces';
import { fullConfig, baseOperaion, adminAddress, maticBridgeAddress, maticLowbAddress  } from '../config';
import * as operationService from 'services';
import { getDepositAmount } from 'services';

import * as contract from '../../blockchain-bridge';
import { getExNetworkMethods, initNetworks, getBinanceNetworkMethods, getMaticNetworkMethods, getInjectMaticNetworkMethods } from '../../blockchain-bridge';
import { sleep, uuid } from '../../utils';
import { sendHrc20Token } from './hrc20';
import { sendErc721Token } from './erc721';
import { getAddress } from '@harmony-js/crypto';
import { send1ETHToken } from './1ETH';
import { send1ONEToken } from './1ONE';
import { getContractMethods } from './helpers';
import { defaultEthClient } from './defaultConfig';
import { NETWORK_BASE_TOKEN, NETWORK_NAME } from '../names';
import { divDecimals } from '../../utils';
import _ from 'lodash';

export enum EXCHANGE_STEPS {
  GET_TOKEN_ADDRESS = 'GET_TOKEN_ADDRESS',
  BASE = 'BASE',
  APPROVE = 'APPROVE',
  CONFIRMATION = 'CONFIRMATION',
  SENDING = 'SENDING',
  RESULT = 'RESULT',
}

export interface IStepConfig {
  id: EXCHANGE_STEPS;
  buttons: Array<{
    title: string;
    onClick: () => void;
    validate?: boolean;
    transparent?: boolean;
  }>;
  title?: string;
}

export interface ITransaction {
  oneAddress: string;
  ethAddress: string;
  amount: string | string[];
  approveAmount: string;
  erc20Address?: string;
  hrc20Address?: string;
}

export class Exchange extends StoreConstructor {
  @observable error = '';
  @observable txHash = '';
  @observable actionStatus: statusFetching = 'init';
  @observable stepNumber = 0;
  @observable isFeeLoading = false;
  @observable isDepositAmountLoading = false;
  @observable depositAmount = 0;

  @observable network: NETWORK_TYPE = NETWORK_TYPE.ETHEREUM;

  defaultTransaction: ITransaction = {
    oneAddress: '',
    ethAddress: '',
    amount: '0',
    approveAmount: '0',
    erc20Address: '',
    hrc20Address: '',
  };

  @observable transaction = this.defaultTransaction;
  @observable mode: EXCHANGE_MODE = EXCHANGE_MODE.ETH_TO_ONE;
  @observable token: TOKEN;

  constructor(stores) {
    super(stores);

    let counts = 0 // use temporarily
    let totalWithdrawals = -1;
    let totalDeposits = -1;


    const getInProgressActionIndex = () =>
    this.operation.actions.findIndex(a => a.status == STATUS.IN_PROGRESS);

    const getWaitingActionIndex = () =>
    this.operation.actions.findIndex(a => a.status == STATUS.WAITING);

    const setOperation = async () => {

      let inProgressIndex = getInProgressActionIndex()
      let waitingIndex = getWaitingActionIndex()

      console.log(counts)

      if (inProgressIndex >= 0) {
        let currentAction = this.operation.actions[inProgressIndex]
        let nextAction = this.operation.actions[inProgressIndex+1]
        if (currentAction.type == ACTION_TYPE.approveEthManger) {
          await this.getAllowance()
          if (!this.needToApprove) {
            currentAction.status = STATUS.SUCCESS
            currentAction.timestamp = (new Date().getTime())/1000
          }
        }
        else if (currentAction.type == ACTION_TYPE.lockToken) {
          if (currentAction.transactionHash) {
            [totalWithdrawals, totalDeposits] = await this.getTotalWithdrawals()
            console.log('total withrawals: ', totalWithdrawals)
            currentAction.status = STATUS.SUCCESS
          }
        }
        else if (currentAction.type == ACTION_TYPE.mintToken) {
          let [newTotalWithdrawals, newTotalDeposits] = await this.getTotalWithdrawals()
          if (newTotalWithdrawals > totalWithdrawals) {
            currentAction.status = STATUS.SUCCESS
          }
        }
        else if (currentAction.type == ACTION_TYPE.getHRC20Address) {
          [totalWithdrawals, totalDeposits] = await this.getTotalWithdrawals()
          console.log('total withrawals: ', totalWithdrawals, totalDeposits)
          if (totalWithdrawals == totalDeposits) {
            currentAction.message = "no pending transactions now"
            currentAction.status = STATUS.SUCCESS
          }
          else {
            currentAction.message = "server is busy now: processing #" + totalDeposits
          }
        }
        else if (counts % 3 == 2) {
          currentAction.status = STATUS.SUCCESS
        }
        if (currentAction.status == STATUS.SUCCESS) {
          if (nextAction) {
            nextAction.status = STATUS.WAITING
          }
          else {
            this.operation.status = STATUS.SUCCESS
          }
          this.setStatus();
        }
      }
      else if (waitingIndex > 1 && waitingIndex < 5) {
        let currentAction = this.operation.actions[waitingIndex]
        currentAction.status = STATUS.IN_PROGRESS
        currentAction.timestamp = (new Date().getTime())/1000
      }

    };

    setInterval(async () => {
      if (this.operation) {
        setOperation()
        counts ++;
        //console.log(counts)
      }
      
    }, 3000);

    autorun(() => {
      const { user, userMetamask } = this.stores;

      if (
        this.operation &&
        this.operation.erc20Address &&
        !this.stores.userMetamask.erc20Address &&
        this.network
      ) {
        if (userMetamask.isAuthorized && userMetamask.isNetworkActual) {
          this.stores.userMetamask.setToken(this.operation.erc20Address);
        } else if (user.isAuthorized && user.isNetworkActual) {
          this.stores.userMetamask.setTokenHRC20(this.operation.erc20Address);
        }
      }
    });

    window.onbeforeunload = (evt): void | string => {
      const isOperationInProgress =
        this.operation && this.operation.status === STATUS.IN_PROGRESS;

      const isUserOwnerEth =
        this.operation.type === EXCHANGE_MODE.ETH_TO_ONE &&
        this.operation.ethAddress === this.stores.userMetamask.ethAddress;

      const isUserOwnerHmy =
        this.operation.type === EXCHANGE_MODE.ONE_TO_ETH &&
        this.operation.oneAddress === this.stores.user.address;

      if (isOperationInProgress && (isUserOwnerEth || isUserOwnerHmy)) {
        evt.preventDefault();

        const dialogText =
          'Operation is in progress! Reloading the page can lead to desynchronization with the wallet.';

        evt.returnValue = dialogText;

        return dialogText;
      }
    };
  }

  @computed
  get step() {
    return this.stepsConfig[this.stepNumber];
  }

  @observable ethNetworkFee = 0;

  @computed
  get networkFee() {
    return this.mode === EXCHANGE_MODE.ETH_TO_ONE
      ? this.ethNetworkFee
      : this.depositAmount + 0.0134438;
  }

  stepsConfig: Array<IStepConfig> = [
    {
      id: EXCHANGE_STEPS.BASE,
      buttons: [
        {
          title: 'Continue',
          onClick: async () => {
            if (
              this.mode === EXCHANGE_MODE.ETH_TO_ONE &&
              (!this.stores.userMetamask.isNetworkActual ||
                !this.stores.userMetamask.isAuthorized)
            ) {
              throw new Error(
                `Your MetaMask in on the wrong network. Please switch on ${
                  NETWORK_NAME[this.stores.exchange.network]
                } ${process.env.NETWORK} and try again!`,
              );
            }

            if (
              this.stores.exchange.mode === EXCHANGE_MODE.ONE_TO_ETH &&
              (!this.stores.userMatic.isNetworkActual ||
                !this.stores.userMatic.isAuthorized)
            ) {
              throw new Error(
                `Your MetaMask in on the wrong network. Please switch on ${
                  NETWORK_NAME[this.stores.exchange.network]
                } ${process.env.NETWORK} and try again!`,
              );
            }

            // this.transaction.oneAddress = this.stores.user.address;

            this.transaction.erc20Address = this.stores.userMetamask.erc20Address;

            // if (this.stores.user.hrc20Address) {
            //   this.transaction.hrc20Address = getAddress(
            //     this.stores.user.hrc20Address,
            //   ).checksum;
            // }

            let lowbBalance, bridgeFees, ethAddress;

            switch (this.mode) {
              case EXCHANGE_MODE.ETH_TO_ONE:
                this.transaction.ethAddress = this.stores.userMetamask.ethAddress;
                lowbBalance = this.stores.userMetamask.erc20Balance
                ethAddress = this.transaction.oneAddress
                bridgeFees = this.stores.userMetamask.bridgeFees
                break;
              case EXCHANGE_MODE.ONE_TO_ETH:
                this.transaction.oneAddress = this.stores.userMatic.ethAddress;
                this.transaction.hrc20Address = this.stores.userMatic.erc20Address;
                lowbBalance = this.stores.userMatic.erc20Balance
                ethAddress = this.transaction.ethAddress
                bridgeFees = this.stores.userMatic.bridgeFees
                break;
            }

            this.transaction.approveAmount = '0';

            console.log(lowbBalance, ethAddress)

            if (Number(this.transaction.amount) <= Number(bridgeFees) || Number(this.transaction.amount) > Number(lowbBalance) || ethAddress == "") {
              return
            }

            if (
              this.token === TOKEN.ERC721 ||
              (this.token === TOKEN.ONE &&
                this.mode === EXCHANGE_MODE.ONE_TO_ETH) ||
              (this.token === TOKEN.ETH &&
                this.mode === EXCHANGE_MODE.ETH_TO_ONE)
            ) {
              this.stepNumber = this.stepNumber + 2;
            } 
            else {
              await this.getAllowance();

              if (
                Number(this.allowance) / 1e18 >=
                Number(this.transaction.amount)
              ) {
                this.stepNumber = this.stepNumber + 2;
              } else {
                this.transaction.approveAmount = String(
                  this.transaction.amount,
                );
                this.stepNumber = this.stepNumber + 1;
              }
            }

            const exNetwork = getExNetworkMethods();
            //const maticNetwork = getMaticNetworkMethods();

            switch (this.mode) {
              case EXCHANGE_MODE.ETH_TO_ONE:
                this.isFeeLoading = true;
                this.ethNetworkFee = await exNetwork.getNetworkFee();
                this.isFeeLoading = false;
                break;
              case EXCHANGE_MODE.ONE_TO_ETH:
                this.isFeeLoading = true;
                this.ethNetworkFee = await exNetwork.getNetworkFee();
                this.isFeeLoading = false;
                break;
            }
          },
          //validate: true,
        },
      ],
    },
    {
      id: EXCHANGE_STEPS.APPROVE,
      buttons: [
        {
          title: 'Back',
          onClick: () => (this.stepNumber = this.stepNumber - 1),
          transparent: true,
        },
        {
          title: 'Continue',
          onClick: () => {
            this.stepNumber = this.stepNumber + 1;
          },
          validate: true,
        },
      ],
    },
    {
      id: EXCHANGE_STEPS.CONFIRMATION,
      buttons: [
        {
          title: 'Back',
          onClick: () => {
            if (Number(this.transaction.approveAmount) > 0) {
              this.stepNumber = this.stepNumber - 1;
            } else {
              this.stepNumber = 0;
            }
          },
          transparent: true,
        },
        {
          title: 'Confirm',
          onClick: () => {
            this.stepNumber = this.stepNumber + 1;
            this.sendOperation();
          },
        },
      ],
    },
    {
      id: EXCHANGE_STEPS.SENDING,
      buttons: [],
    },
    {
      id: EXCHANGE_STEPS.RESULT,
      buttons: [
        {
          title: 'Close',
          transparent: true,
          onClick: () => {
            this.setMode(this.mode);
            this.stepNumber = 0;
          },
        },
      ],
    },
  ];

  @action.bound
  setAddressByMode() {
    if (this.mode === EXCHANGE_MODE.ETH_TO_ONE) {
      // this.transaction.oneAddress = this.stores.user.address;
      this.transaction.oneAddress = '';
      this.transaction.ethAddress = this.stores.userMetamask.ethAddress;
    }

    if (this.mode === EXCHANGE_MODE.ONE_TO_ETH) {
      // this.transaction.ethAddress = this.stores.userMetamask.ethAddress;
      this.transaction.ethAddress = '';
      this.transaction.oneAddress = this.stores.userMatic.ethAddress;
    }
  }

  @action.bound
  setMode(mode: EXCHANGE_MODE) {
    if (
      this.operation &&
      [STATUS.IN_PROGRESS, STATUS.WAITING].includes(this.operation.status)
    ) {
      return;
    }

    this.clear();
    this.mode = mode;
    this.setAddressByMode();
  }

  @action.bound
  setNetwork(network: NETWORK_TYPE) {
    if (
      this.operation &&
      [STATUS.IN_PROGRESS, STATUS.WAITING].includes(this.operation.status)
    ) {
      return;
    }

    this.clear();
    this.network = network;

    this.stores.userMetamask.erc20TokenDetails = null;
    this.stores.userMetamask.erc20Address = '';
    this.stores.userMetamask.ethBalance = '0';
    this.stores.userMetamask.erc20Balance = '0';
    this.stores.userMetamask.ethBUSDBalance = '0';
    this.stores.userMetamask.ethLINKBalance = '0';

    this.stores.user.hrc20Address = '';
    this.stores.user.balance = '0';
    this.stores.user.hrc20Balance = '0';
    this.stores.user.hrc20Balance = '0';
    this.stores.user.hmyBUSDBalance = '0';
    this.stores.user.hmyLINKBalance = '0';
    // this.setAddressByMode();

    if (!this.config.tokens.includes(this.token)) {
      this.setToken(this.config.tokens[0]);
    } else {
      this.setToken(this.token);
    }

    this.setMode(this.mode);
  }

  @action.bound
  setToken(token: TOKEN) {
    // this.clear();
    this.token = token;
    // this.setAddressByMode();

    if (token === TOKEN.ETH) {
      this.stores.user.setHRC20Token(this.config.contracts.nativeTokenHRC20);
      this.stores.userMetamask.erc20Address = '';

      this.stores.userMetamask.setTokenDetails({
        name: NETWORK_BASE_TOKEN[this.network],
        decimals: '18',
        erc20Address: '',
        symbol: NETWORK_BASE_TOKEN[this.network],
      });
    }

    if (token === TOKEN.ONE) {
      this.stores.user.setHRC20Mapping(process.env.ONE_HRC20, true);
    }
  }

  @observable operation: IOperation;

  @action.bound
  setStatus() {
    switch (this.operation.status) {
      case STATUS.ERROR:
        this.actionStatus = 'error';
        this.stepNumber = this.stepsConfig.length - 1;
        break;

      case STATUS.SUCCESS:
        this.actionStatus = 'success';
        this.stepNumber = this.stepsConfig.length - 1;
        break;

      case STATUS.WAITING:
      case STATUS.IN_PROGRESS:
        this.stepNumber = 3;
        this.actionStatus = 'fetching';
        break;
    }
  }

  @action.bound
  async setOperationId(operationId: string) {
    this.operation = _.cloneDeep(baseOperaion)

    //this.mode = this.operation.type;
    this.token = this.operation.token;
    this.network = this.operation.network;
    // this.transaction.amount = Array.isArray(this.operation.amount)
    //   ? this.operation.amount
    //   : String(this.operation.amount);
    // this.operation.ethAddress = this.stores.userMetamask.ethAddress; // correct the address
    // this.operation.oneAddress = this.stores.userMatic.ethAddress; // correct the address
    // this.transaction.ethAddress = this.operation.ethAddress;
    // this.transaction.oneAddress = this.operation.oneAddress;
    this.transaction.erc20Address = this.operation.erc20Address; // no use actually

    this.setStatus();
  }

  @action.bound
  async createOperation() {
    this.operation = _.cloneDeep(baseOperaion)

    return this.operation.id;
  }

  getActionByType = (type: ACTION_TYPE) =>
    this.operation.actions.find(a => a.type === type);

  @action.bound
  async sendOperation(id: string = '') { //after I click the confirm button, operation start...
    try {
      this.actionStatus = 'fetching';

      let operationId = id;

      //if (!operationId) { // if operation not created yet, create it
        operationId = await this.createOperation(); //we don't need id

        //this.stores.routing.push(
          //this.token + '/operations/' + this.operation.id,
        //);
      //}

      // if (!operationId) {
      //   const bridgeSDK = new BridgeSDK({ logLevel: 2 }); // 2 - full logs, 1 - only success & errors, 0 - logs off
      //
      //   await bridgeSDK.init(configs.testnet);
      //
      //   await bridgeSDK.setUseOneWallet(true);
      //   await bridgeSDK.setUseMetamask(true);
      //
      //   await bridgeSDK.sendToken(
      //     {
      //       ...this.transaction,
      //       amount: Number(this.transaction.amount),
      //       type: this.mode,
      //       token: this.token,
      //     },
      //     id => this.setOperationId(id),
      //   );
      //
      //   return;
      // }

      await this.setOperationId(operationId);

      if (
        this.operation.status === STATUS.SUCCESS ||
        this.operation.status === STATUS.ERROR
      ) {
        return;
      }

      const confirmCallback = async (
        transactionHash,
        actionType: ACTION_TYPE,
      ) => {
        console.log(transactionHash == 'skip')
        let action = this.getActionByType(actionType)
        action.transactionHash = transactionHash
        // this.operation = await operationService.confirmAction({
        //   operationId,
        //   transactionHash,
        //   actionType,
        // });
      };

      if (!this.stores.user.address || !this.stores.userMetamask.ethAddress) {
        await sleep(3000);
      }

      //console.log(this.operation.ethAddress, this.stores.userMetamask.ethAddress)

      // if (this.mode === EXCHANGE_MODE.ETH_TO_ONE) {
      //   if (this.operation.ethAddress !== this.stores.userMetamask.ethAddress) {
      //     return;
      //   }
      // }

      let ethMethods, hmyMethods;
      const exNetwork = getExNetworkMethods();
      const binanceNetwork = getBinanceNetworkMethods();
      const maticNetwork = getMaticNetworkMethods();
      const injectMaticNetwork = getInjectMaticNetworkMethods();

      switch (this.token) {
        case TOKEN.BUSD:
          ethMethods = exNetwork.ethMethodsBUSD;
          hmyMethods = this.stores.user.isMetamask
            ? contract.hmyMethodsBUSD.hmyMethodsWeb3
            : contract.hmyMethodsBUSD.hmyMethods;
          break;

        case TOKEN.LINK:
          ethMethods = exNetwork.ethMethodsLINK;
          hmyMethods = this.stores.user.isMetamask
            ? contract.hmyMethodsLINK.hmyMethodsWeb3
            : contract.hmyMethodsLINK.hmyMethods;
          break;

        case TOKEN.ERC20:
          if (this.mode === EXCHANGE_MODE.ETH_TO_ONE) {
            hmyMethods = maticNetwork.ethMethodsERC20; // cheat it!
            ethMethods = exNetwork.ethMethodsERC20;
          }
          if (this.mode === EXCHANGE_MODE.ONE_TO_ETH) {
            hmyMethods = injectMaticNetwork.ethMethodsERC20; // cheat it!
            ethMethods = binanceNetwork.ethMethodsERC20;
          }
          break;

        case TOKEN.ONE:
          await send1ONEToken({
            transaction: this.transaction,
            mode: this.mode,
            stores: this.stores,
            getActionByType: this.getActionByType,
            confirmCallback: confirmCallback,
          });
          return;

        case TOKEN.ETH:
          await send1ETHToken({
            transaction: this.transaction,
            mode: this.mode,
            stores: this.stores,
            getActionByType: this.getActionByType,
            confirmCallback: confirmCallback,
          });
          return;

        case TOKEN.ERC721:
          await sendErc721Token({
            transaction: this.transaction,
            mode: this.mode,
            stores: this.stores,
            getActionByType: this.getActionByType,
            confirmCallback: confirmCallback,
          });
          return;

        case TOKEN.HRC20:
          await sendHrc20Token({
            transaction: this.transaction,
            mode: this.mode,
            stores: this.stores,
            getActionByType: this.getActionByType,
            confirmCallback: confirmCallback,
          });
          return;
      }


      if (this.token === TOKEN.ERC20) { // now we will focus on these steps...
        let getHRC20Action = this.getActionByType(ACTION_TYPE.getHRC20Address);

        if (this.mode === EXCHANGE_MODE.ETH_TO_ONE) {
          const adminEthBalance = await maticNetwork.getEthBalance(adminAddress);
          const bridgeEthBalance = await maticNetwork.getEthBalance(maticBridgeAddress);
          let res = await hmyMethods.checkEthBalance(maticLowbAddress, maticBridgeAddress);
          const lowbBalance = divDecimals(res, 18);
          console.log(adminEthBalance, bridgeEthBalance, lowbBalance, this.transaction.amount)
          if (Number(adminEthBalance) < 0.1 || Number(bridgeEthBalance) < 0.1) {
            getHRC20Action.error = "Oracle account has not enough MATIC now"
            getHRC20Action.status = STATUS.ERROR
          }
          else if (Number(lowbBalance) < Number(this.transaction.amount)) {
            getHRC20Action.error = "Lack of liquidity: " + lowbBalance + " lowb in the pool."
            getHRC20Action.status = STATUS.ERROR
          }
          else {
            getHRC20Action.status = STATUS.IN_PROGRESS
            getHRC20Action.timestamp = (new Date().getTime())/1000
          }
        }

        if (this.mode === EXCHANGE_MODE.ONE_TO_ETH) {
          const adminEthBalance = await binanceNetwork.getEthBalance(adminAddress);
          console.log(adminEthBalance)
          if (Number(adminEthBalance) < 0.1) {
            getHRC20Action.error = "Oracle account has not enough BNB now"
            getHRC20Action.status = STATUS.ERROR
          }
          else {
            getHRC20Action.status = STATUS.SUCCESS
          }
        }

        while (
          getHRC20Action &&
          [STATUS.IN_PROGRESS, STATUS.WAITING].includes(getHRC20Action.status)
        ) {
          await sleep(3000);
          getHRC20Action = this.getActionByType(ACTION_TYPE.getHRC20Address);
        }

        if (getHRC20Action.status !== STATUS.SUCCESS) {
          throw getHRC20Action.error
        }

        /* if (!this.stores.user.hrc20Address) {
          await this.stores.userMetamask.setToken(
            this.transaction.erc20Address,
          );
        }console.log(this.stores.userMetamask.erc20TokenDetails) */
        
        if (this.mode === EXCHANGE_MODE.ETH_TO_ONE) {
          let approveEthManger = this.getActionByType(
            ACTION_TYPE.approveEthManger,
          );
          
          if (approveEthManger && approveEthManger.status === STATUS.WAITING) {
            approveEthManger.status = STATUS.IN_PROGRESS
            const { approveAmount, erc20Address } = this.transaction;

            ethMethods.approveEthManger(
              erc20Address,
              approveAmount,
              this.stores.userMetamask.erc20TokenDetails.decimals,
              hash => confirmCallback(hash, approveEthManger.type), 
            ); 
          }

          while (
            [STATUS.WAITING, STATUS.IN_PROGRESS].includes(
              approveEthManger.status,
            )
          ) {
            approveEthManger = this.getActionByType(
              ACTION_TYPE.approveEthManger,
            );

            await sleep(500);
          }

          if (approveEthManger.status !== STATUS.SUCCESS) {
            return;
          }

          const lockToken = this.getActionByType(ACTION_TYPE.lockToken);

          if (lockToken.status === STATUS.WAITING || lockToken.status === STATUS.IN_PROGRESS) {
            
            await ethMethods.lockToken(
              this.transaction.oneAddress,
              this.transaction.amount,
              this.stores.userMetamask.erc20TokenDetails.decimals,
              hash => confirmCallback(hash, lockToken.type),
            );
          }

          return;
        }

        if (this.mode === EXCHANGE_MODE.ONE_TO_ETH) {
          const hrc20Address = this.stores.userMetamask.erc20Address

          let approveHmyManger = this.getActionByType(
            ACTION_TYPE.approveEthManger,
          );

          if (approveHmyManger && approveHmyManger.status === STATUS.WAITING) {
            approveHmyManger.status = STATUS.IN_PROGRESS
            await hmyMethods.approveEthManger(
              hrc20Address,
              this.transaction.approveAmount,
              this.stores.userMetamask.erc20TokenDetails.decimals,
              hash => confirmCallback(hash, approveHmyManger.type),
            );
          }

          while (
            [STATUS.WAITING, STATUS.IN_PROGRESS].includes(
              approveHmyManger.status,
            )
          ) {
            approveHmyManger = this.getActionByType(
              ACTION_TYPE.approveEthManger,
            );

            await sleep(500);
          }

          if (approveHmyManger.status !== STATUS.SUCCESS) {
            return;
          }

          const lockToken = this.getActionByType(ACTION_TYPE.lockToken);

          if (lockToken.status === STATUS.WAITING || lockToken.status === STATUS.IN_PROGRESS) {
            
            await hmyMethods.lockToken(
              this.transaction.ethAddress,
              this.transaction.amount,
              this.stores.userMetamask.erc20TokenDetails.decimals,
              hash => confirmCallback(hash, lockToken.type),
            );
          }

          return;
        }
      } 
      else {
        if (this.mode === EXCHANGE_MODE.ETH_TO_ONE) {
          let approveEthManger = this.getActionByType(
            ACTION_TYPE.approveEthManger,
          );

          if (approveEthManger && approveEthManger.status === STATUS.WAITING) {
            ethMethods.approveEthManger(this.transaction.approveAmount, hash =>
              confirmCallback(hash, approveEthManger.type),
            );
          }

          while (
            [STATUS.WAITING, STATUS.IN_PROGRESS].includes(
              approveEthManger.status,
            )
          ) {
            approveEthManger = this.getActionByType(
              ACTION_TYPE.approveEthManger,
            );

            await sleep(500);
          }

          if (approveEthManger.status !== STATUS.SUCCESS) {
            return;
          }

          const lockToken = this.getActionByType(ACTION_TYPE.lockToken);

          if (lockToken && lockToken.status === STATUS.WAITING) {
            await ethMethods.lockToken(
              this.transaction.oneAddress,
              this.transaction.amount,
              hash => confirmCallback(hash, lockToken.type),
            );
          }

          return;
        }

        if (this.mode === EXCHANGE_MODE.ONE_TO_ETH) {
          let approveHmyManger = this.getActionByType(
            ACTION_TYPE.approveHmyManger,
          );

          if (approveHmyManger && approveHmyManger.status === STATUS.WAITING) {
            await hmyMethods.approveHmyManger(
              this.transaction.approveAmount,
              hash => confirmCallback(hash, approveHmyManger.type),
            );
          }

          while (
            [STATUS.WAITING, STATUS.IN_PROGRESS].includes(
              approveHmyManger.status,
            )
          ) {
            approveHmyManger = this.getActionByType(
              ACTION_TYPE.approveHmyManger,
            );

            await sleep(500);
          }

          if (approveHmyManger.status !== STATUS.SUCCESS) {
            return;
          }

          const burnToken = this.getActionByType(ACTION_TYPE.burnToken);

          if (burnToken && burnToken.status === STATUS.WAITING) {
            await hmyMethods.burnToken(
              this.transaction.ethAddress,
              this.transaction.amount,
              hash => confirmCallback(hash, burnToken.type),
            );
          }

          return;
        }
      }

      return;
    } catch (e) {
      if (e.status && e.response.body) {
        this.error = e.response.body.message;
      } else {
        this.error = e.message || e;
      }

      this.actionStatus = 'error';
      this.operation = null;
    }

    this.stepNumber = this.stepsConfig.length - 1;
  }

  @observable allowance = '0';
  @observable allowanceStatus: statusFetching = 'init';
  @observable allowanceError = '';

  @computed get needToApprove() {
    const allowance = divDecimals(this.allowance, 18);
    console.log(this.transaction.amount, allowance);
    return Number(this.transaction.amount) > allowance;
  }

  @action.bound
  clearAllowance = () => {
    this.allowance = '0';
    this.allowanceStatus = 'fetching';
    this.allowanceError = '';
  };

  @action.bound
  getAllowance = async () => {
    this.allowance = '0';
    this.transaction.approveAmount = '0';
    this.allowanceStatus = 'fetching';
    this.allowanceError = '';

    const { ethMethods, hmyMethods } = getContractMethods(
      this.token,
      this.network,
      this.stores.user.isMetamask,
    );

    try {
      if (this.mode === EXCHANGE_MODE.ONE_TO_ETH) {
        console.log(this.transaction.oneAddress, this.transaction.hrc20Address);

        this.allowance = await hmyMethods.allowance(
          this.transaction.oneAddress,
          this.transaction.hrc20Address,
        );
      }

      if (this.mode === EXCHANGE_MODE.ETH_TO_ONE) {
        console.log(this.transaction.ethAddress, this.transaction.erc20Address);

        this.allowance = await ethMethods.allowance(
          this.transaction.ethAddress,
          this.transaction.erc20Address,
        );
      }
    } catch (e) {
      this.allowanceError = e.message;
    }

    this.allowanceStatus = 'success';
  };

  @action.bound
  async getTotalWithdrawals () {

    const { ethMethods, hmyMethods } = getContractMethods(
      this.token,
      this.network,
      this.stores.user.isMetamask,
    );

    let totalWithdrawals, totalDeposits

    if (this.mode === EXCHANGE_MODE.ETH_TO_ONE) {
      totalWithdrawals = await hmyMethods.totalWithdrawals();
      totalDeposits = await ethMethods.totalDeposits();
    }
    if (this.mode === EXCHANGE_MODE.ONE_TO_ETH) {
      totalWithdrawals = await ethMethods.totalWithdrawals();
      totalDeposits = await hmyMethods.totalDeposits();
    }
    return [totalWithdrawals, totalDeposits]
  };

  clear() {
    this.transaction = this.defaultTransaction;
    this.operation = null;
    this.error = '';
    this.txHash = '';
    this.actionStatus = 'init';
    this.stepNumber = 0;
    this.stores.routing.push(`/${this.token}`);
  }

  @observable fullConfig: TFullConfig;

  @action.bound
  getConfig = async () => {
    this.fullConfig = fullConfig; //get directly from local file
    initNetworks(this.fullConfig);
    this.setToken(this.token);
  };

  @computed
  get config(): TConfig {
    if (!this.fullConfig) {
      return defaultEthClient;
    }

    if (this.network === NETWORK_TYPE.ETHEREUM) {
      return this.fullConfig.ethClient;
    }

    if (this.network === NETWORK_TYPE.BINANCE) {
      return this.fullConfig.binanceClient;
    }

    return this.fullConfig.ethClient;
  }

  getExplorerByNetwork(network: NETWORK_TYPE) {
    if (!this.fullConfig) {
      return defaultEthClient.explorerURL;
    }

    switch (network) {
      case NETWORK_TYPE.BINANCE:
        return this.fullConfig.binanceClient.explorerURL;
      case NETWORK_TYPE.ETHEREUM:
        return this.fullConfig.ethClient.explorerURL;
    }
  }
}
