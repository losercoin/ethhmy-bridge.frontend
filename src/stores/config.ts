import _ from 'lodash';
import {
    TConfig,
    TFullConfig,
    TOKEN,
    NETWORK_TYPE,
    ITokenInfo,
    IAction,
    STATUS,
    ACTION_TYPE,
    EXCHANGE_MODE,
    IOperation
} from './interfaces';

const ethClient: TConfig = {
    nodeURL: "https://kovan.infura.io/v3",
    explorerURL: "https://kovan.etherscan.io",
    tokens: [
        //TOKEN.ERC721,
        //TOKEN.BUSD,
        //TOKEN.LINK,
        TOKEN.ERC20,
        //TOKEN.ETH
    ],
    contracts: {
      busd: "0xb0e18106520d05adA2C7fcB1a95f7db5e3f28345",
      link: "0x69FcFe4aFF2778d15f186AcF8845a0Dc0ec08CC7",
      busdManager: "0x89Cb9b988ECe933becbA1001aEd98BdAa660Ef29",
      linkManager: "0xe65143628d598F867Ed5139Ff783bA6f33D51bFa",
      erc20Manager: "0xba1f4b06225A2Cf8B56D711539CbbeF1c097a886",
      erc721Manager: "0x364907a5B9ba4A3353B4Dd11aDC0b2bE8AC58253",
      multisigWallet: "0x4D2F08369476F21D4DEB834b6EA9c41ACAd11413",
      tokenManager: "0xAa0fFF0074E898B922DBAb2c7496cdcC84A28fa0",
      hrc20Manager: "0xA64D59E4350f61679ACDE8eEC06421233Bd2B4E1",
      ethManager: "0xCE670B66C5296e29AB39aBECBC92c60ea330F5dC",
      nativeTokenHRC20: "0x268d6fF391B41B36A13B1693BD25f87FB4E4b392"
    }
}

const binanceClient: TConfig = {
    nodeURL: "https://data-seed-prebsc-1-s1.binance.org:8545",
    explorerURL: "https://testnet.bscscan.com",
    tokens: [
        TOKEN.ERC20,
        //TOKEN.ETH
    ],
    contracts: {
      erc20Manager: "0x7eeCb093d520e09a42b4c47cDFF34FB67625FC72",  // change this contract address !!!
      multisigWallet: "0x310336b9EBc8291f2Fde665145110d2ace555a13",
      hrc20Manager: "0x9867Ac5A9155BF75715ebb205ef7cBc1C0a412A1", 
      ethManager: "0x792bEC87EB65a59c5051Ee76c19E80D444A3C8e1",
      nativeTokenHRC20: "0xBEF55684b382BaE72051813a898d17282066c007",
      tokenManager: "0x24f5301f563809F78e1307e8Fb102b453E6c40c6",
      erc721Manager: "0x426A61A2127fDD1318Ec0EdCe02474f382FdAd30",
      busd: "0xa011471158D19854aF08A22839f81321309D4A12",
      busdManager: "0xCC93449c89e8064124FFe1E9d3A84398b4f90ebd",
      link: "0xFEFB4061d5c4F096D29e6ac8e300314b5F00199c",
      linkManager: "0x9EDC8d0Bde1Fc666831Bda1ded5B34A45f9E886C"
    },
    gasPrice: 20000000000,
    network: 'bsc'
  }

  const maticClient: TConfig = {
    nodeURL: "https://rpc-mumbai.maticvigil.com",
    explorerURL: "https://explorer-mumbai.maticvigil.com/",
    tokens: [
        TOKEN.ERC20,
        //TOKEN.ETH
    ],
    contracts: {
      erc20Manager: "0xDC05ED497f43DE362C7fB112FAFaBBD5EE8B48Bd",  // change this contract address !!!
      multisigWallet: "0x310336b9EBc8291f2Fde665145110d2ace555a13",
      hrc20Manager: "0x9867Ac5A9155BF75715ebb205ef7cBc1C0a412A1", 
      ethManager: "0x792bEC87EB65a59c5051Ee76c19E80D444A3C8e1",
      nativeTokenHRC20: "0xBEF55684b382BaE72051813a898d17282066c007",
      tokenManager: "0x24f5301f563809F78e1307e8Fb102b453E6c40c6",
      erc721Manager: "0x426A61A2127fDD1318Ec0EdCe02474f382FdAd30",
      busd: "0xa011471158D19854aF08A22839f81321309D4A12",
      busdManager: "0xCC93449c89e8064124FFe1E9d3A84398b4f90ebd",
      link: "0xFEFB4061d5c4F096D29e6ac8e300314b5F00199c",
      linkManager: "0x9EDC8d0Bde1Fc666831Bda1ded5B34A45f9E886C"
    },
    gasPrice: 5000000000,
    network: 'matic'
  }

  const binanceClientMainnet: TConfig = {
    nodeURL: "https://bsc-dataseed1.binance.org",
    explorerURL: "https://bscscan.com/",
    tokens: [
        TOKEN.ERC20,
        //TOKEN.ETH
    ],
    contracts: {
      erc20Manager: "0xDC05ED497f43DE362C7fB112FAFaBBD5EE8B48Bd",  // change this contract address !!!
      multisigWallet: "0x310336b9EBc8291f2Fde665145110d2ace555a13",
      hrc20Manager: "0x9867Ac5A9155BF75715ebb205ef7cBc1C0a412A1", 
      ethManager: "0x792bEC87EB65a59c5051Ee76c19E80D444A3C8e1",
      nativeTokenHRC20: "0xBEF55684b382BaE72051813a898d17282066c007",
      tokenManager: "0x24f5301f563809F78e1307e8Fb102b453E6c40c6",
      erc721Manager: "0x426A61A2127fDD1318Ec0EdCe02474f382FdAd30",
      busd: "0xa011471158D19854aF08A22839f81321309D4A12",
      busdManager: "0xCC93449c89e8064124FFe1E9d3A84398b4f90ebd",
      link: "0xFEFB4061d5c4F096D29e6ac8e300314b5F00199c",
      linkManager: "0x9EDC8d0Bde1Fc666831Bda1ded5B34A45f9E886C"
    },
    gasPrice: 5000000000,
    network: 'bsc'
  }

  const maticClientMainnet: TConfig = {
    nodeURL: "https://rpc-mainnet.maticvigil.com",
    explorerURL: "https://polygonscan.com/",
    tokens: [
        TOKEN.ERC20,
        //TOKEN.ETH
    ],
    contracts: {
      erc20Manager: "0xDC05ED497f43DE362C7fB112FAFaBBD5EE8B48Bd",  // change this contract address !!!
      multisigWallet: "0x310336b9EBc8291f2Fde665145110d2ace555a13",
      hrc20Manager: "0x9867Ac5A9155BF75715ebb205ef7cBc1C0a412A1", 
      ethManager: "0x792bEC87EB65a59c5051Ee76c19E80D444A3C8e1",
      nativeTokenHRC20: "0xBEF55684b382BaE72051813a898d17282066c007",
      tokenManager: "0x24f5301f563809F78e1307e8Fb102b453E6c40c6",
      erc721Manager: "0x426A61A2127fDD1318Ec0EdCe02474f382FdAd30",
      busd: "0xa011471158D19854aF08A22839f81321309D4A12",
      busdManager: "0xCC93449c89e8064124FFe1E9d3A84398b4f90ebd",
      link: "0xFEFB4061d5c4F096D29e6ac8e300314b5F00199c",
      linkManager: "0x9EDC8d0Bde1Fc666831Bda1ded5B34A45f9E886C"
    },
    gasPrice: 5000000000,
    network: 'matic'
  }

  const busdInfo: ITokenInfo = {
    name: "Binance USD",
    symbol: "BUSD",
    decimals: "18",
    erc20Address: "0xb0e18106520d05adA2C7fcB1a95f7db5e3f28345",
    hrc20Address: "0xc4860463c59d59a9afac9fde35dff9da363e8425",
    token: TOKEN.ERC20,
    network: NETWORK_TYPE.ETHEREUM,
    totalSupply: "1716082368000000000204",
    totalLockedNormal: "1716.082368000000000204",
    totalLockedUSD: "1716.2539762368"
  }

  const lowbInfo: ITokenInfo = {
    name: "loser coin",
    symbol: "lowb",
    decimals: "18",
    erc20Address: "0x5aa1a18432aa60bad7f3057d71d3774f56cd34b8",
    hrc20Address: "0x5cd4d2f947ae4568a8bd0905dbf12d3454d197f3",
    token: TOKEN.ERC20,
    network: NETWORK_TYPE.BINANCE,
    totalSupply: "1716082368000000000204",
    totalLockedNormal: "1716.082368000000000204",
    totalLockedUSD: "1716.2539762368"
  }

  const lowbInfoMainnet: ITokenInfo = {
    name: "loser coin",
    symbol: "lowb",
    decimals: "18",
    erc20Address: "0x843d4a358471547f51534e3e51fae91cb4dc3f28",
    hrc20Address: "0x1c0a798b5a5273a9e54028eb1524fd337b24145f",
    token: TOKEN.ERC20,
    network: NETWORK_TYPE.BINANCE,
    totalSupply: "1716082368000000000204",
    totalLockedNormal: "1716.082368000000000204",
    totalLockedUSD: "1716.2539762368"
  }

  const testNFTInfo: ITokenInfo = {
    name: "Test NFT",
    symbol: "TestNFT",
    decimals: null,
    erc20Address: "0x49360c18403dFEa42CFA8112C113E733091C0F3b",
    hrc20Address: "0x46633D7aE2cE53FdbeDC5ef69F2b42279Fd729E0",
    token: TOKEN.ERC721,
    network: NETWORK_TYPE.ETHEREUM,
    totalSupply: "1",
    totalLockedNormal: "0",
    totalLockedUSD: "0"
  }

  const getAddressWaiting: IAction = {
    id: "0135822a-46c2c508-3233267a-3ca69954",
    type: ACTION_TYPE.getHRC20Address,
    status: STATUS.WAITING,
    timestamp: null,
    payload: null,
    transactionHash: null,
    error: null,
    message: null
  }


  const approveEthWaiting: IAction = {
    id: "2ea5626d-be38aea6-c0ca098c-b8e41ae8",
    type: ACTION_TYPE.approveEthManger,
    status: STATUS.WAITING,
    timestamp: null,
    payload: null,
    transactionHash: null,
    error: null,
    message: null
  }


  const lockWaiting: IAction = {
    id: "540dcb4e-5eab1d50-f2efa385-33b3a1f1",
    type: ACTION_TYPE.lockToken,
    status: STATUS.WAITING,
    timestamp: null,
    payload: null,
    transactionHash: null,
    error: null,
    message: null
  }


  const waitBlockWaiting: IAction = {
    id: "11945d8e-7cb373a3-d5798771-4de1c088",
    type: ACTION_TYPE.waitingBlockNumber,
    status: STATUS.WAITING,
    timestamp: null,
    payload: null,
    transactionHash: null,
    error: null,
    message: null
  }


  const mintWaiting: IAction = {
    id: "762607ff-3038f80d-5d5834a3-0fb07d63",
    type: ACTION_TYPE.mintToken,
    status: STATUS.WAITING,
    timestamp: null,
    payload: null,
    transactionHash: null,
    error: null,
    message: null
  }


  // export const fullConfig: TFullConfig = {
  //   ethClient: ethClient,
  //   binanceClient: binanceClient,
  //   hmyClient: maticClient
  // };

  // export const allTokenData: ITokenInfo[] = [
  //   busdInfo,
  //   lowbInfo,
  //   testNFTInfo
  // ];

  // export const baseOperaion: IOperation = {
  //   id: "cdc5656f-25415aff-a0a1316a-a0eb65c1",
  //   type: EXCHANGE_MODE.ETH_TO_ONE,
  //   erc20Address: "0x5aa1a18432aa60bad7f3057d71d3774f56cd34b8",
  //   hrc20Address: "0x498c9f1D43F34eB68FBd19B6a0544f1AAae649c0",
  //   token: TOKEN.ERC20,
  //   network: NETWORK_TYPE.BINANCE,
  //   status: STATUS.IN_PROGRESS,
  //   amount: 1000,
  //   ethAddress: "0xd35a860b6fdb386ae9d83d72209daa704631ca15",
  //   oneAddress: "0xd35a860b6fdb386ae9d83d72209daa704631ca15",
  //   timestamp: null,
  //   fee: null,
  //   actions: [getAddressWaiting, approveEthWaiting, lockWaiting, waitBlockWaiting, mintWaiting]
  // }

  // export const adminAddress = '0xD35a860B6fDB386Ae9d83D72209DAA704631CA15'
  // export const maticBridgeAddress = '0x9867Ac5A9155BF75715ebb205ef7cBc1C0a412A1'
  // export const maticLowbAddress = '0x5cd4d2f947ae4568a8bd0905dbf12d3454d197f3'
  // export const maticClientExplorerURL = "https://explorer-mumbai.maticvigil.com/"


  export const fullConfig: TFullConfig = {
    ethClient: ethClient,
    binanceClient: binanceClientMainnet,
    hmyClient: maticClientMainnet
  };

  export const allTokenData: ITokenInfo[] = [
    busdInfo,
    lowbInfoMainnet,
    testNFTInfo
  ];

  export const baseOperaion: IOperation = {
    id: "cdc5656f-25415aff-a0a1316a-a0eb65c1",
    type: EXCHANGE_MODE.ETH_TO_ONE,
    erc20Address: "0x843d4a358471547f51534e3e51fae91cb4dc3f28",
    hrc20Address: "0x1c0a798b5a5273a9e54028eb1524fd337b24145f",
    token: TOKEN.ERC20,
    network: NETWORK_TYPE.BINANCE,
    status: STATUS.IN_PROGRESS,
    amount: 10000,
    ethAddress: "0x6Bf8a9Af2CA25D593A17255694b798eB97f0F5c7",
    oneAddress: "0x6Bf8a9Af2CA25D593A17255694b798eB97f0F5c7",
    timestamp: null,
    fee: null,
    actions: [getAddressWaiting, approveEthWaiting, lockWaiting, waitBlockWaiting, mintWaiting]
  }

  export const adminAddress = '0x6Bf8a9Af2CA25D593A17255694b798eB97f0F5c7'
  export const maticBridgeAddress = '0xDC05ED497f43DE362C7fB112FAFaBBD5EE8B48Bd'
  export const maticLowbAddress = '0x1c0a798b5a5273a9e54028eb1524fd337b24145f'
  export const maticClientExplorerURL = "https://polygonscan.com/"