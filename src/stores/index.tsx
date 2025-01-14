import RouterStore from 'stores/RouterStore';
import { ActionModalsStore } from './ActionModalsStore';
import { UserStoreEx } from './UserStore';
import { UserStoreMatic } from './UserStoreMatic';
import { UserStoreMetamask } from './UserStoreMetamask';
import { Exchange } from './Exchange';
import { Operations } from './Operations';
import { AdminOperations } from './AdminOperations';
import { Tokens } from './Tokens';
import { createStoresContext } from './create-context';
import { Erc20SelectStore } from './Erc20SelectStore';
import { NETWORK_TYPE } from './interfaces';

export interface IStores {
  routing?: RouterStore;
  actionModals?: ActionModalsStore;
  user?: UserStoreEx;
  userMatic?: UserStoreMatic;
  userMetamask?: UserStoreMetamask;
  exchange?: Exchange;
  operations?: Operations;
  adminOperations?: AdminOperations;
  tokens?: Tokens;
  erc20Select?: Erc20SelectStore;
}

const stores: IStores = {};

stores.routing = new RouterStore();
stores.exchange = new Exchange(stores);
stores.exchange.network = NETWORK_TYPE.BINANCE // force to change to BINANCE!!!
stores.operations = new Operations(stores);
stores.adminOperations = new AdminOperations(stores);
stores.tokens = new Tokens(stores);
stores.actionModals = new ActionModalsStore();
stores.user = new UserStoreEx(stores);
stores.userMatic = new UserStoreMatic(stores);
stores.userMetamask = new UserStoreMetamask(stores);
stores.erc20Select = new Erc20SelectStore(stores);

if (!process.env.production) {
  window.stores = stores;
}

const { StoresProvider, useStores } = createStoresContext<typeof stores>();
export { StoresProvider, useStores };

export default stores;
