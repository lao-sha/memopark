/**
 * 通用占卜服务
 *
 * 提供与 pallet-divination-nft、pallet-divination-ai、pallet-divination-market 的交互
 * 支持多种玄学系统：梅花易数、八字命理、六爻占卜、奇门遁甲、紫微斗数、大六壬、小六壬、塔罗牌、太乙神数
 */

import { getApi, getSignedApi } from '../lib/polkadot';
import {
  DivinationType,
  InterpretationType,
  InterpretationStatus,
  ServiceType,
  OrderStatus,
  Rarity,
  ProviderTier,
  Specialty,
  OracleStatus,
  type DivinationResultBase,
  type ServiceProvider,
  type ServicePackage,
  type MarketOrder,
  type Review,
  type InterpretationRequest,
  type InterpretationResult,
  type DivinationNft,
  type NftCollection,
  type NftOffer,
  type ModelConfig,
  type OracleNode,
  type OracleModelInfo,
  type OracleModelSupport,
  DIVINATION_TYPE_NAMES,
  INTERPRETATION_FEE_MULTIPLIER,
  DIVINATION_FEE_MULTIPLIER,
} from '../types/divination';

// ==================== 类型辅助 ====================

/**
 * 将 DivinationType 转换为 pallet 名称
 *
 * 映射前端占卜类型枚举到对应的链上 pallet 名称
 */
function getPalletName(divinationType: DivinationType): string {
  switch (divinationType) {
    case DivinationType.Meihua:
      return 'meihua';
    case DivinationType.Bazi:
      return 'baziChart';
    case DivinationType.Liuyao:
      return 'liuyao';
    case DivinationType.Qimen:
      return 'qimen';
    case DivinationType.Ziwei:
      return 'ziwei';
    case DivinationType.Daliuren:
      return 'daliuren';
    case DivinationType.XiaoLiuRen:
      return 'xiaoliuren';
    case DivinationType.Tarot:
      return 'tarot';
    case DivinationType.Taiyi:
      return 'taiyi';
    default:
      return 'meihua';
  }
}

// ==================== AI 解读服务（通用） ====================

/**
 * 请求 AI 解读（通用）
 * @param divinationType 占卜类型
 * @param resultId 占卜结果 ID
 * @param interpretationType 解读类型
 */
export async function requestDivinationInterpretation(
  divinationType: DivinationType,
  resultId: number,
  interpretationType: InterpretationType
): Promise<number> {
  const api = await getSignedApi();
  const tx = api.tx.divinationAi.requestInterpretation(
    divinationType,
    resultId,
    interpretationType
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events }) => {
      if (status.isInBlock) {
        const event = events.find((e) =>
          e.event.section === 'divinationAi' && e.event.method === 'InterpretationRequested'
        );
        if (event) {
          const requestId = event.event.data[0].toNumber();
          resolve(requestId);
        }
      }
    }).catch(reject);
  });
}

/**
 * 获取 AI 解读请求详情
 */
export async function getDivinationInterpretationRequest(
  requestId: number
): Promise<InterpretationRequest | null> {
  const api = await getApi();
  const result = await api.query.divinationAi.requests(requestId);

  if (result.isNone) return null;

  const data = result.unwrap();
  return {
    id: requestId,
    divinationType: data.divinationType.toNumber(),
    resultId: data.resultId.toNumber(),
    requester: data.requester.toString(),
    interpretationType: data.interpretationType.toNumber(),
    status: data.status.toNumber(),
    feePaid: data.feePaid.toBigInt(),
    createdAt: data.createdAt.toNumber(),
    oracleNode: data.oracleNode.isSome ? data.oracleNode.unwrap().toString() : undefined,
    completedAt: data.completedAt.isSome ? data.completedAt.unwrap().toNumber() : undefined,
  };
}

/**
 * 获取 AI 解读结果
 */
export async function getDivinationInterpretationResult(
  requestId: number
): Promise<InterpretationResult | null> {
  const api = await getApi();
  const result = await api.query.divinationAi.results(requestId);

  if (result.isNone) return null;

  const data = result.unwrap();
  return {
    requestId,
    contentCid: new TextDecoder().decode(new Uint8Array(data.contentCid.toU8a())),
    summaryCid: data.summaryCid.isSome
      ? new TextDecoder().decode(new Uint8Array(data.summaryCid.unwrap().toU8a()))
      : undefined,
    oracle: data.oracle.toString(),
    submittedAt: data.submittedAt.toNumber(),
    qualityScore: data.qualityScore.isSome ? data.qualityScore.unwrap().toNumber() : undefined,
    userRating: data.userRating.isSome ? data.userRating.unwrap().toNumber() : undefined,
    modelVersion: new TextDecoder().decode(new Uint8Array(data.modelVersion.toU8a())),
    language: new TextDecoder().decode(new Uint8Array(data.language.toU8a())),
  };
}

/**
 * 评价 AI 解读结果
 */
export async function rateDivinationInterpretation(
  requestId: number,
  rating: number
): Promise<void> {
  const api = await getSignedApi();
  const tx = api.tx.divinationAi.rateResult(requestId, rating);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status }) => {
      if (status.isInBlock) {
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 获取用户的解读请求列表
 */
export async function getUserInterpretationRequests(
  address: string,
  divinationType?: DivinationType
): Promise<InterpretationRequest[]> {
  const api = await getApi();
  const entries = await api.query.divinationAi.requests.entries();

  const requests: InterpretationRequest[] = [];
  for (const [key, value] of entries) {
    if (value.isNone) continue;
    const data = value.unwrap();

    // 过滤用户
    if (data.requester.toString() !== address) continue;

    // 过滤占卜类型（如果指定）
    if (divinationType !== undefined && data.divinationType.toNumber() !== divinationType) continue;

    const requestId = key.args[0].toNumber();
    requests.push({
      id: requestId,
      divinationType: data.divinationType.toNumber(),
      resultId: data.resultId.toNumber(),
      requester: data.requester.toString(),
      interpretationType: data.interpretationType.toNumber(),
      status: data.status.toNumber(),
      feePaid: data.feePaid.toBigInt(),
      createdAt: data.createdAt.toNumber(),
      oracleNode: data.oracleNode.isSome ? data.oracleNode.unwrap().toString() : undefined,
      completedAt: data.completedAt.isSome ? data.completedAt.unwrap().toNumber() : undefined,
    });
  }

  return requests.sort((a, b) => b.createdAt - a.createdAt);
}

// ==================== 通用 NFT 服务 ====================

/**
 * 铸造占卜结果 NFT（通用）
 * @param divinationType 占卜类型
 * @param resultId 占卜结果 ID
 * @param name NFT 名称
 * @param metadataCid IPFS 元数据 CID
 * @param royaltyRate 版税比例（万分比）
 */
export async function mintDivinationNft(
  divinationType: DivinationType,
  resultId: number,
  name: string,
  metadataCid: string,
  royaltyRate: number
): Promise<number> {
  const api = await getSignedApi();
  const tx = api.tx.divinationNft.mint(
    divinationType,
    resultId,
    Array.from(new TextEncoder().encode(name)),
    Array.from(new TextEncoder().encode(metadataCid)),
    royaltyRate
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events }) => {
      if (status.isInBlock) {
        const event = events.find((e) =>
          e.event.section === 'divinationNft' && e.event.method === 'NftMinted'
        );
        if (event) {
          const nftId = event.event.data[0].toNumber();
          resolve(nftId);
        }
      }
    }).catch(reject);
  });
}

/**
 * 获取 NFT 详情
 */
export async function getDivinationNft(nftId: number): Promise<DivinationNft | null> {
  const api = await getApi();
  const result = await api.query.divinationNft.nfts(nftId);

  if (result.isNone) return null;

  const data = result.unwrap();
  return {
    id: nftId,
    divinationType: data.divinationType.toNumber(),
    resultId: data.resultId.toNumber(),
    owner: data.owner.toString(),
    creator: data.creator.toString(),
    name: new TextDecoder().decode(new Uint8Array(data.name.toU8a())),
    metadataCid: new TextDecoder().decode(new Uint8Array(data.metadataCid.toU8a())),
    imageCid: data.imageCid.isSome
      ? new TextDecoder().decode(new Uint8Array(data.imageCid.unwrap().toU8a()))
      : undefined,
    rarity: data.rarity.toNumber(),
    royaltyRate: data.royaltyRate.toNumber(),
    mintedAt: data.mintedAt.toNumber(),
    isListed: data.isListed.isTrue,
    listPrice: data.listPrice.isSome ? data.listPrice.unwrap().toBigInt() : undefined,
    transferCount: data.transferCount.toNumber(),
  };
}

/**
 * 获取用户的 NFT 列表
 */
export async function getUserDivinationNfts(
  address: string,
  divinationType?: DivinationType
): Promise<DivinationNft[]> {
  const api = await getApi();
  const entries = await api.query.divinationNft.nfts.entries();

  const nfts: DivinationNft[] = [];
  for (const [key, value] of entries) {
    if (value.isNone) continue;
    const data = value.unwrap();

    // 过滤所有者
    if (data.owner.toString() !== address) continue;

    // 过滤占卜类型（如果指定）
    if (divinationType !== undefined && data.divinationType.toNumber() !== divinationType) continue;

    const nftId = key.args[0].toNumber();
    nfts.push({
      id: nftId,
      divinationType: data.divinationType.toNumber(),
      resultId: data.resultId.toNumber(),
      owner: data.owner.toString(),
      creator: data.creator.toString(),
      name: new TextDecoder().decode(new Uint8Array(data.name.toU8a())),
      metadataCid: new TextDecoder().decode(new Uint8Array(data.metadataCid.toU8a())),
      imageCid: data.imageCid.isSome
        ? new TextDecoder().decode(new Uint8Array(data.imageCid.unwrap().toU8a()))
        : undefined,
      rarity: data.rarity.toNumber(),
      royaltyRate: data.royaltyRate.toNumber(),
      mintedAt: data.mintedAt.toNumber(),
      isListed: data.isListed.isTrue,
      listPrice: data.listPrice.isSome ? data.listPrice.unwrap().toBigInt() : undefined,
      transferCount: data.transferCount.toNumber(),
    });
  }

  return nfts.sort((a, b) => b.mintedAt - a.mintedAt);
}

/**
 * 获取已上架的 NFT 列表
 */
export async function getListedDivinationNfts(
  divinationType?: DivinationType
): Promise<DivinationNft[]> {
  const api = await getApi();
  const entries = await api.query.divinationNft.nfts.entries();

  const listedNfts: DivinationNft[] = [];
  for (const [key, value] of entries) {
    if (value.isNone) continue;
    const data = value.unwrap();
    if (!data.isListed.isTrue) continue;

    // 过滤占卜类型（如果指定）
    if (divinationType !== undefined && data.divinationType.toNumber() !== divinationType) continue;

    const nftId = key.args[0].toNumber();
    listedNfts.push({
      id: nftId,
      divinationType: data.divinationType.toNumber(),
      resultId: data.resultId.toNumber(),
      owner: data.owner.toString(),
      creator: data.creator.toString(),
      name: new TextDecoder().decode(new Uint8Array(data.name.toU8a())),
      metadataCid: new TextDecoder().decode(new Uint8Array(data.metadataCid.toU8a())),
      imageCid: data.imageCid.isSome
        ? new TextDecoder().decode(new Uint8Array(data.imageCid.unwrap().toU8a()))
        : undefined,
      rarity: data.rarity.toNumber(),
      royaltyRate: data.royaltyRate.toNumber(),
      mintedAt: data.mintedAt.toNumber(),
      isListed: true,
      listPrice: data.listPrice.isSome ? data.listPrice.unwrap().toBigInt() : undefined,
      transferCount: data.transferCount.toNumber(),
    });
  }

  return listedNfts.sort((a, b) => b.mintedAt - a.mintedAt);
}

/**
 * 上架 NFT
 */
export async function listDivinationNft(nftId: number, price: bigint): Promise<void> {
  const api = await getSignedApi();
  const tx = api.tx.divinationNft.list(nftId, price.toString());

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status }) => {
      if (status.isInBlock) {
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 下架 NFT
 */
export async function cancelDivinationNftListing(nftId: number): Promise<void> {
  const api = await getSignedApi();
  const tx = api.tx.divinationNft.cancelListing(nftId);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status }) => {
      if (status.isInBlock) {
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 购买 NFT
 */
export async function buyDivinationNft(nftId: number): Promise<void> {
  const api = await getSignedApi();
  const tx = api.tx.divinationNft.buy(nftId);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status }) => {
      if (status.isInBlock) {
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 转移 NFT
 */
export async function transferDivinationNft(nftId: number, to: string): Promise<void> {
  const api = await getSignedApi();
  const tx = api.tx.divinationNft.transfer(nftId, to);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status }) => {
      if (status.isInBlock) {
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 对 NFT 出价
 */
export async function makeDivinationNftOffer(nftId: number, amount: bigint): Promise<number> {
  const api = await getSignedApi();
  const tx = api.tx.divinationNft.makeOffer(nftId, amount.toString());

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events }) => {
      if (status.isInBlock) {
        const event = events.find((e) =>
          e.event.section === 'divinationNft' && e.event.method === 'OfferMade'
        );
        if (event) {
          const offerId = event.event.data[0].toNumber();
          resolve(offerId);
        }
      }
    }).catch(reject);
  });
}

/**
 * 取消 NFT 出价
 */
export async function cancelDivinationNftOffer(offerId: number): Promise<void> {
  const api = await getSignedApi();
  const tx = api.tx.divinationNft.cancelOffer(offerId);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status }) => {
      if (status.isInBlock) {
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 接受 NFT 出价
 */
export async function acceptDivinationNftOffer(offerId: number): Promise<void> {
  const api = await getSignedApi();
  const tx = api.tx.divinationNft.acceptOffer(offerId);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status }) => {
      if (status.isInBlock) {
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 获取 NFT 的出价列表
 */
export async function getDivinationNftOffers(nftId: number): Promise<NftOffer[]> {
  const api = await getApi();
  const entries = await api.query.divinationNft.offers.entries();

  const offers: NftOffer[] = [];
  for (const [key, value] of entries) {
    if (value.isNone) continue;
    const data = value.unwrap();
    if (data.nftId.toNumber() !== nftId) continue;

    const offerId = key.args[0].toNumber();
    offers.push({
      id: offerId,
      nftId: data.nftId.toNumber(),
      bidder: data.bidder.toString(),
      amount: data.amount.toBigInt(),
      expiresAt: data.expiresAt.toNumber(),
      createdAt: data.createdAt.toNumber(),
    });
  }

  return offers.sort((a, b) => Number(b.amount - a.amount));
}

/**
 * 创建 NFT 收藏集
 */
export async function createDivinationNftCollection(
  name: string,
  descriptionCid?: string,
  coverCid?: string
): Promise<number> {
  const api = await getSignedApi();
  const tx = api.tx.divinationNft.createCollection(
    Array.from(new TextEncoder().encode(name)),
    descriptionCid ? { Some: Array.from(new TextEncoder().encode(descriptionCid)) } : { None: null },
    coverCid ? { Some: Array.from(new TextEncoder().encode(coverCid)) } : { None: null }
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events }) => {
      if (status.isInBlock) {
        const event = events.find((e) =>
          e.event.section === 'divinationNft' && e.event.method === 'CollectionCreated'
        );
        if (event) {
          const collectionId = event.event.data[0].toNumber();
          resolve(collectionId);
        }
      }
    }).catch(reject);
  });
}

/**
 * 获取收藏集详情
 */
export async function getDivinationNftCollection(collectionId: number): Promise<NftCollection | null> {
  const api = await getApi();
  const result = await api.query.divinationNft.collections(collectionId);

  if (result.isNone) return null;

  const data = result.unwrap();
  return {
    id: collectionId,
    owner: data.owner.toString(),
    name: new TextDecoder().decode(new Uint8Array(data.name.toU8a())),
    descriptionCid: data.descriptionCid.isSome
      ? new TextDecoder().decode(new Uint8Array(data.descriptionCid.unwrap().toU8a()))
      : undefined,
    coverCid: data.coverCid.isSome
      ? new TextDecoder().decode(new Uint8Array(data.coverCid.unwrap().toU8a()))
      : undefined,
    nftCount: data.nftCount.toNumber(),
    createdAt: data.createdAt.toNumber(),
  };
}

/**
 * 获取用户的收藏集列表
 */
export async function getUserDivinationNftCollections(address: string): Promise<NftCollection[]> {
  const api = await getApi();
  const entries = await api.query.divinationNft.collections.entries();

  const collections: NftCollection[] = [];
  for (const [key, value] of entries) {
    if (value.isNone) continue;
    const data = value.unwrap();
    if (data.owner.toString() !== address) continue;

    const collectionId = key.args[0].toNumber();
    collections.push({
      id: collectionId,
      owner: data.owner.toString(),
      name: new TextDecoder().decode(new Uint8Array(data.name.toU8a())),
      descriptionCid: data.descriptionCid.isSome
        ? new TextDecoder().decode(new Uint8Array(data.descriptionCid.unwrap().toU8a()))
        : undefined,
      coverCid: data.coverCid.isSome
        ? new TextDecoder().decode(new Uint8Array(data.coverCid.unwrap().toU8a()))
        : undefined,
      nftCount: data.nftCount.toNumber(),
      createdAt: data.createdAt.toNumber(),
    });
  }

  return collections.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * 添加 NFT 到收藏集
 */
export async function addDivinationNftToCollection(collectionId: number, nftId: number): Promise<void> {
  const api = await getSignedApi();
  const tx = api.tx.divinationNft.addToCollection(collectionId, nftId);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status }) => {
      if (status.isInBlock) {
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 从收藏集移除 NFT
 */
export async function removeDivinationNftFromCollection(collectionId: number, nftId: number): Promise<void> {
  const api = await getSignedApi();
  const tx = api.tx.divinationNft.removeFromCollection(collectionId, nftId);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status }) => {
      if (status.isInBlock) {
        resolve();
      }
    }).catch(reject);
  });
}

// ==================== 通用服务市场 ====================

/**
 * 获取服务提供者列表
 */
export async function getDivinationServiceProviders(
  divinationType?: DivinationType
): Promise<ServiceProvider[]> {
  const api = await getApi();
  const entries = await api.query.divinationMarket.providers.entries();

  const providers: ServiceProvider[] = [];
  for (const [, value] of entries) {
    if (value.isNone) continue;
    const data = value.unwrap();

    // 过滤占卜类型（如果指定）
    if (divinationType !== undefined) {
      const supportedTypes = data.supportedDivinationTypes.toNumber();
      if ((supportedTypes & (1 << divinationType)) === 0) continue;
    }

    providers.push({
      account: data.account.toString(),
      name: new TextDecoder().decode(new Uint8Array(data.name.toU8a())),
      bio: new TextDecoder().decode(new Uint8Array(data.bio.toU8a())),
      avatarCid: data.avatarCid.isSome
        ? new TextDecoder().decode(new Uint8Array(data.avatarCid.unwrap().toU8a()))
        : undefined,
      tier: data.tier.toNumber(),
      isActive: data.isActive.isTrue,
      deposit: data.deposit.toBigInt(),
      registeredAt: data.registeredAt.toNumber(),
      totalOrders: data.totalOrders.toNumber(),
      completedOrders: data.completedOrders.toNumber(),
      cancelledOrders: data.cancelledOrders.toNumber(),
      totalRatings: data.totalRatings.toNumber(),
      ratingSum: data.ratingSum.toNumber(),
      totalEarnings: data.totalEarnings.toBigInt(),
      specialties: data.specialties.toNumber(),
      supportedDivinationTypes: data.supportedDivinationTypes.toNumber(),
      acceptsUrgent: data.acceptsUrgent.isTrue,
      lastActiveAt: data.lastActiveAt.toNumber(),
    });
  }

  return providers.sort((a, b) => b.totalOrders - a.totalOrders);
}

/**
 * 获取服务提供者详情
 */
export async function getDivinationServiceProvider(address: string): Promise<ServiceProvider | null> {
  const api = await getApi();
  const result = await api.query.divinationMarket.providers(address);

  if (result.isNone) return null;

  const data = result.unwrap();
  return {
    account: data.account.toString(),
    name: new TextDecoder().decode(new Uint8Array(data.name.toU8a())),
    bio: new TextDecoder().decode(new Uint8Array(data.bio.toU8a())),
    avatarCid: data.avatarCid.isSome
      ? new TextDecoder().decode(new Uint8Array(data.avatarCid.unwrap().toU8a()))
      : undefined,
    tier: data.tier.toNumber(),
    isActive: data.isActive.isTrue,
    deposit: data.deposit.toBigInt(),
    registeredAt: data.registeredAt.toNumber(),
    totalOrders: data.totalOrders.toNumber(),
    completedOrders: data.completedOrders.toNumber(),
    cancelledOrders: data.cancelledOrders.toNumber(),
    totalRatings: data.totalRatings.toNumber(),
    ratingSum: data.ratingSum.toNumber(),
    totalEarnings: data.totalEarnings.toBigInt(),
    specialties: data.specialties.toNumber(),
    supportedDivinationTypes: data.supportedDivinationTypes.toNumber(),
    acceptsUrgent: data.acceptsUrgent.isTrue,
    lastActiveAt: data.lastActiveAt.toNumber(),
  };
}

/**
 * 获取提供者的服务套餐
 */
export async function getDivinationProviderPackages(
  providerAddress: string,
  divinationType?: DivinationType
): Promise<ServicePackage[]> {
  const api = await getApi();
  const entries = await api.query.divinationMarket.packages.entries(providerAddress);

  const packages: ServicePackage[] = [];
  for (const [key, value] of entries) {
    if (value.isNone) continue;
    const packageId = key.args[1].toNumber();
    const data = value.unwrap();

    // 过滤占卜类型（如果指定）
    if (divinationType !== undefined && data.divinationType.toNumber() !== divinationType) continue;

    packages.push({
      id: packageId,
      divinationType: data.divinationType.toNumber(),
      serviceType: data.serviceType.toNumber(),
      name: new TextDecoder().decode(new Uint8Array(data.name.toU8a())),
      description: new TextDecoder().decode(new Uint8Array(data.description.toU8a())),
      price: data.price.toBigInt(),
      duration: data.duration.toNumber(),
      followUpCount: data.followUpCount.toNumber(),
      urgentAvailable: data.urgentAvailable.isTrue,
      urgentSurcharge: data.urgentSurcharge.toNumber(),
      isActive: data.isActive.isTrue,
      salesCount: data.salesCount.toNumber(),
    });
  }

  return packages.sort((a, b) => Number(a.price - b.price));
}

/**
 * 注册成为服务提供者
 */
export async function registerDivinationProvider(
  name: string,
  bio: string,
  specialties: number,
  supportedDivinationTypes: number
): Promise<void> {
  const api = await getSignedApi();
  const tx = api.tx.divinationMarket.registerProvider(
    Array.from(new TextEncoder().encode(name)),
    Array.from(new TextEncoder().encode(bio)),
    specialties,
    supportedDivinationTypes
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status }) => {
      if (status.isInBlock) {
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 创建服务套餐
 */
export async function createDivinationPackage(
  divinationType: DivinationType,
  serviceType: ServiceType,
  name: string,
  description: string,
  price: bigint,
  duration: number,
  followUpCount: number,
  urgentAvailable: boolean,
  urgentSurcharge: number
): Promise<number> {
  const api = await getSignedApi();
  const tx = api.tx.divinationMarket.createPackage(
    divinationType,
    serviceType,
    Array.from(new TextEncoder().encode(name)),
    Array.from(new TextEncoder().encode(description)),
    price.toString(),
    duration,
    followUpCount,
    urgentAvailable,
    urgentSurcharge
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events }) => {
      if (status.isInBlock) {
        const event = events.find((e) =>
          e.event.section === 'divinationMarket' && e.event.method === 'PackageCreated'
        );
        if (event) {
          const packageId = event.event.data[1].toNumber();
          resolve(packageId);
        }
      }
    }).catch(reject);
  });
}

/**
 * 创建市场订单
 */
export async function createDivinationMarketOrder(
  providerAddress: string,
  divinationType: DivinationType,
  resultId: number,
  packageId: number,
  questionCid: string,
  isUrgent: boolean
): Promise<number> {
  const api = await getSignedApi();
  const questionBytes = new TextEncoder().encode(questionCid);
  const tx = api.tx.divinationMarket.createOrder(
    providerAddress,
    divinationType,
    resultId,
    packageId,
    Array.from(questionBytes),
    isUrgent
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, events }) => {
      if (status.isInBlock) {
        const event = events.find((e) =>
          e.event.section === 'divinationMarket' && e.event.method === 'OrderCreated'
        );
        if (event) {
          const orderId = event.event.data[0].toNumber();
          resolve(orderId);
        }
      }
    }).catch(reject);
  });
}

/**
 * 获取订单详情
 */
export async function getDivinationMarketOrder(orderId: number): Promise<MarketOrder | null> {
  const api = await getApi();
  const result = await api.query.divinationMarket.orders(orderId);

  if (result.isNone) return null;

  const data = result.unwrap();
  return {
    id: orderId,
    customer: data.customer.toString(),
    provider: data.provider.toString(),
    divinationType: data.divinationType.toNumber(),
    resultId: data.resultId.toNumber(),
    packageId: data.packageId.toNumber(),
    amount: data.amount.toBigInt(),
    platformFee: data.platformFee.toBigInt(),
    isUrgent: data.isUrgent.isTrue,
    status: data.status.toNumber(),
    questionCid: new TextDecoder().decode(new Uint8Array(data.questionCid.toU8a())),
    interpretationCid: data.interpretationCid.isSome
      ? new TextDecoder().decode(new Uint8Array(data.interpretationCid.unwrap().toU8a()))
      : undefined,
    createdAt: data.createdAt.toNumber(),
    paidAt: data.paidAt.isSome ? data.paidAt.unwrap().toNumber() : undefined,
    acceptedAt: data.acceptedAt.isSome ? data.acceptedAt.unwrap().toNumber() : undefined,
    completedAt: data.completedAt.isSome ? data.completedAt.unwrap().toNumber() : undefined,
    followUpsRemaining: data.followUpsRemaining.toNumber(),
    rating: data.rating.isSome ? data.rating.unwrap().toNumber() : undefined,
    reviewCid: data.reviewCid.isSome
      ? new TextDecoder().decode(new Uint8Array(data.reviewCid.unwrap().toU8a()))
      : undefined,
  };
}

/**
 * 获取用户的订单列表（作为客户）
 */
export async function getUserDivinationOrders(
  address: string,
  divinationType?: DivinationType
): Promise<MarketOrder[]> {
  const api = await getApi();
  const entries = await api.query.divinationMarket.orders.entries();

  const orders: MarketOrder[] = [];
  for (const [key, value] of entries) {
    if (value.isNone) continue;
    const data = value.unwrap();

    // 过滤客户
    if (data.customer.toString() !== address) continue;

    // 过滤占卜类型（如果指定）
    if (divinationType !== undefined && data.divinationType.toNumber() !== divinationType) continue;

    const orderId = key.args[0].toNumber();
    orders.push({
      id: orderId,
      customer: data.customer.toString(),
      provider: data.provider.toString(),
      divinationType: data.divinationType.toNumber(),
      resultId: data.resultId.toNumber(),
      packageId: data.packageId.toNumber(),
      amount: data.amount.toBigInt(),
      platformFee: data.platformFee.toBigInt(),
      isUrgent: data.isUrgent.isTrue,
      status: data.status.toNumber(),
      questionCid: new TextDecoder().decode(new Uint8Array(data.questionCid.toU8a())),
      answerCid: data.answerCid.isSome
        ? new TextDecoder().decode(new Uint8Array(data.answerCid.unwrap().toU8a()))
        : undefined,
      createdAt: data.createdAt.toNumber(),
      paidAt: data.paidAt.isSome ? data.paidAt.unwrap().toNumber() : undefined,
      acceptedAt: data.acceptedAt.isSome ? data.acceptedAt.unwrap().toNumber() : undefined,
      completedAt: data.completedAt.isSome ? data.completedAt.unwrap().toNumber() : undefined,
      followUpsRemaining: data.followUpsRemaining.toNumber(),
      rating: data.rating.isSome ? data.rating.unwrap().toNumber() : undefined,
      reviewCid: data.reviewCid.isSome
        ? new TextDecoder().decode(new Uint8Array(data.reviewCid.unwrap().toU8a()))
        : undefined,
    });
  }

  return orders.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * 获取服务提供者的订单列表
 */
export async function getProviderDivinationOrders(
  providerAddress: string,
  divinationType?: DivinationType
): Promise<MarketOrder[]> {
  const api = await getApi();
  const entries = await api.query.divinationMarket.orders.entries();

  const orders: MarketOrder[] = [];
  for (const [key, value] of entries) {
    if (value.isNone) continue;
    const data = value.unwrap();

    // 过滤提供者
    if (data.provider.toString() !== providerAddress) continue;

    // 过滤占卜类型（如果指定）
    if (divinationType !== undefined && data.divinationType.toNumber() !== divinationType) continue;

    const orderId = key.args[0].toNumber();
    orders.push({
      id: orderId,
      customer: data.customer.toString(),
      provider: data.provider.toString(),
      divinationType: data.divinationType.toNumber(),
      resultId: data.resultId.toNumber(),
      packageId: data.packageId.toNumber(),
      amount: data.amount.toBigInt(),
      platformFee: data.platformFee.toBigInt(),
      isUrgent: data.isUrgent.isTrue,
      status: data.status.toNumber(),
      questionCid: new TextDecoder().decode(new Uint8Array(data.questionCid.toU8a())),
      answerCid: data.answerCid.isSome
        ? new TextDecoder().decode(new Uint8Array(data.answerCid.unwrap().toU8a()))
        : undefined,
      createdAt: data.createdAt.toNumber(),
      paidAt: data.paidAt.isSome ? data.paidAt.unwrap().toNumber() : undefined,
      acceptedAt: data.acceptedAt.isSome ? data.acceptedAt.unwrap().toNumber() : undefined,
      completedAt: data.completedAt.isSome ? data.completedAt.unwrap().toNumber() : undefined,
      followUpsRemaining: data.followUpsRemaining.toNumber(),
      rating: data.rating.isSome ? data.rating.unwrap().toNumber() : undefined,
      reviewCid: data.reviewCid.isSome
        ? new TextDecoder().decode(new Uint8Array(data.reviewCid.unwrap().toU8a()))
        : undefined,
    });
  }

  return orders.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * 提交订单评价
 */
export async function submitDivinationReview(
  orderId: number,
  overallRating: number,
  accuracyRating: number,
  attitudeRating: number,
  responseRating: number,
  contentCid?: string,
  isAnonymous: boolean = false
): Promise<void> {
  const api = await getSignedApi();
  const tx = api.tx.divinationMarket.submitReview(
    orderId,
    overallRating,
    accuracyRating,
    attitudeRating,
    responseRating,
    contentCid ? { Some: Array.from(new TextEncoder().encode(contentCid)) } : { None: null },
    isAnonymous
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status }) => {
      if (status.isInBlock) {
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 取消订单
 */
export async function cancelDivinationOrder(orderId: number): Promise<void> {
  const api = await getSignedApi();
  const tx = api.tx.divinationMarket.cancelOrder(orderId);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status }) => {
      if (status.isInBlock) {
        resolve();
      }
    }).catch(reject);
  });
}

// ==================== 辅助函数 ====================

/**
 * 计算解读费用
 */
export function calculateInterpretationFee(
  baseFee: bigint,
  interpretationType: InterpretationType
): bigint {
  const multiplier = INTERPRETATION_FEE_MULTIPLIER[interpretationType];
  return BigInt(Math.floor(Number(baseFee) * multiplier));
}

/**
 * 格式化占卜类型显示名称
 */
export function formatDivinationTypeName(divinationType: DivinationType): string {
  return DIVINATION_TYPE_NAMES[divinationType] || '未知类型';
}

/**
 * 检查是否支持某种占卜类型
 */
export function isDivinationTypeSupported(
  supportedTypes: number,
  divinationType: DivinationType
): boolean {
  return (supportedTypes & (1 << divinationType)) !== 0;
}

/**
 * 构建支持的占卜类型位图
 */
export function buildSupportedDivinationTypes(types: DivinationType[]): number {
  return types.reduce((bitmap, type) => bitmap | (1 << type), 0);
}

// ==================== Oracle 节点服务（新增） ====================

/**
 * 获取所有 Oracle 节点列表
 *
 * 查询链上所有已注册的 AI 解读 Oracle 节点
 */
export async function getOracleNodes(): Promise<OracleNode[]> {
  const api = await getApi();
  const entries = await api.query.divinationAi.oracleNodes.entries();

  const nodes: OracleNode[] = [];
  for (const [, value] of entries) {
    if (value.isNone) continue;
    const data = value.unwrap();

    // 解析支持的模型列表
    const supportedModels: OracleModelInfo[] = [];
    if (data.supportedModels) {
      for (const model of data.supportedModels) {
        const supportedTypes: DivinationType[] = [];
        if (model.supportedTypes) {
          for (const t of model.supportedTypes) {
            supportedTypes.push(t.toNumber() as DivinationType);
          }
        }
        supportedModels.push({
          modelId: new TextDecoder().decode(new Uint8Array(model.modelId.toU8a())),
          version: model.version.toNumber(),
          supportedTypes,
          isPrimary: model.isPrimary.isTrue,
        });
      }
    }

    nodes.push({
      account: data.account.toString(),
      name: new TextDecoder().decode(new Uint8Array(data.name.toU8a())),
      description: data.description?.isSome
        ? new TextDecoder().decode(new Uint8Array(data.description.unwrap().toU8a()))
        : undefined,
      status: data.status.toNumber() as OracleStatus,
      stakeAmount: data.stakeAmount.toBigInt(),
      rating: data.rating.toNumber(),
      totalCompleted: data.totalCompleted.toNumber(),
      totalFailed: data.totalFailed.toNumber(),
      registeredAt: data.registeredAt.toNumber(),
      lastActiveAt: data.lastActiveAt.toNumber(),
      supportedModels,
      activeRequests: data.activeRequests.toNumber(),
      maxConcurrent: data.maxConcurrent.toNumber(),
    });
  }

  // 按评分排序
  return nodes.sort((a, b) => b.rating - a.rating);
}

/**
 * 获取单个 Oracle 节点详情
 *
 * @param account Oracle 节点账户地址
 */
export async function getOracleNode(account: string): Promise<OracleNode | null> {
  const api = await getApi();
  const result = await api.query.divinationAi.oracleNodes(account);

  if (result.isNone) return null;

  const data = result.unwrap();

  // 解析支持的模型列表
  const supportedModels: OracleModelInfo[] = [];
  if (data.supportedModels) {
    for (const model of data.supportedModels) {
      const supportedTypes: DivinationType[] = [];
      if (model.supportedTypes) {
        for (const t of model.supportedTypes) {
          supportedTypes.push(t.toNumber() as DivinationType);
        }
      }
      supportedModels.push({
        modelId: new TextDecoder().decode(new Uint8Array(model.modelId.toU8a())),
        version: model.version.toNumber(),
        supportedTypes,
        isPrimary: model.isPrimary.isTrue,
      });
    }
  }

  return {
    account: data.account.toString(),
    name: new TextDecoder().decode(new Uint8Array(data.name.toU8a())),
    description: data.description?.isSome
      ? new TextDecoder().decode(new Uint8Array(data.description.unwrap().toU8a()))
      : undefined,
    status: data.status.toNumber() as OracleStatus,
    stakeAmount: data.stakeAmount.toBigInt(),
    rating: data.rating.toNumber(),
    totalCompleted: data.totalCompleted.toNumber(),
    totalFailed: data.totalFailed.toNumber(),
    registeredAt: data.registeredAt.toNumber(),
    lastActiveAt: data.lastActiveAt.toNumber(),
    supportedModels,
    activeRequests: data.activeRequests.toNumber(),
    maxConcurrent: data.maxConcurrent.toNumber(),
  };
}

/**
 * 获取支持指定占卜类型的 Oracle 节点列表
 *
 * @param divinationType 占卜类型
 * @param minRating 最低评分要求（可选，默认 0）
 */
export async function getOracleNodesForDivinationType(
  divinationType: DivinationType,
  minRating: number = 0
): Promise<OracleNode[]> {
  const allNodes = await getOracleNodes();

  return allNodes.filter((node) => {
    // 过滤评分
    if (node.rating < minRating) return false;

    // 过滤状态（只返回活跃节点）
    if (node.status !== OracleStatus.Active) return false;

    // 检查是否支持该占卜类型
    return node.supportedModels.some((model) =>
      model.supportedTypes.includes(divinationType)
    );
  });
}

/**
 * 获取 Oracle 节点的模型支持信息
 *
 * @param account Oracle 节点账户地址
 */
export async function getOracleModelSupport(account: string): Promise<OracleModelSupport | null> {
  const node = await getOracleNode(account);
  if (!node) return null;

  return {
    account: node.account,
    models: node.supportedModels,
  };
}

// ==================== 模型配置服务（新增） ====================

/**
 * 获取所有占卜类型的模型配置
 *
 * 查询链上每种占卜类型的 AI 模型配置
 */
export async function getModelConfigs(): Promise<ModelConfig[]> {
  const api = await getApi();
  const entries = await api.query.divinationAi.modelConfigs.entries();

  const configs: ModelConfig[] = [];
  for (const [key, value] of entries) {
    if (value.isNone) continue;
    const divinationType = key.args[0].toNumber() as DivinationType;
    const data = value.unwrap();

    configs.push({
      divinationType,
      recommendedModelId: new TextDecoder().decode(new Uint8Array(data.recommendedModelId.toU8a())),
      minModelVersion: data.minModelVersion.toNumber(),
      feeMultiplier: data.feeMultiplier.toNumber(),
      maxResponseLength: data.maxResponseLength.toNumber(),
      enabled: data.enabled.isTrue,
      minOracleRating: data.minOracleRating.toNumber(),
      timeoutBlocks: data.timeoutBlocks?.isSome ? data.timeoutBlocks.unwrap().toNumber() : undefined,
    });
  }

  return configs;
}

/**
 * 获取指定占卜类型的模型配置
 *
 * @param divinationType 占卜类型
 */
export async function getModelConfig(divinationType: DivinationType): Promise<ModelConfig | null> {
  const api = await getApi();
  const result = await api.query.divinationAi.modelConfigs(divinationType);

  if (result.isNone) return null;

  const data = result.unwrap();
  return {
    divinationType,
    recommendedModelId: new TextDecoder().decode(new Uint8Array(data.recommendedModelId.toU8a())),
    minModelVersion: data.minModelVersion.toNumber(),
    feeMultiplier: data.feeMultiplier.toNumber(),
    maxResponseLength: data.maxResponseLength.toNumber(),
    enabled: data.enabled.isTrue,
    minOracleRating: data.minOracleRating.toNumber(),
    timeoutBlocks: data.timeoutBlocks?.isSome ? data.timeoutBlocks.unwrap().toNumber() : undefined,
  };
}

/**
 * 检查指定占卜类型是否启用 AI 解读
 *
 * @param divinationType 占卜类型
 */
export async function isDivinationAiEnabled(divinationType: DivinationType): Promise<boolean> {
  const config = await getModelConfig(divinationType);
  return config?.enabled ?? false;
}

// ==================== AI 解读费用计算（增强版） ====================

/**
 * 计算带有占卜类型倍率的解读费用（链上查询版本）
 *
 * 从链上查询模型配置中的费用倍率进行计算
 *
 * @param baseFee 基础费用
 * @param interpretationType 解读类型
 * @param divinationType 占卜类型
 */
export async function calculateDivinationInterpretationFeeFromChain(
  baseFee: bigint,
  interpretationType: InterpretationType,
  divinationType: DivinationType
): Promise<bigint> {
  const modelConfig = await getModelConfig(divinationType);
  const interpretationMultiplier = INTERPRETATION_FEE_MULTIPLIER[interpretationType];

  // 如果有链上配置则使用链上费用倍率，否则使用默认值
  const divinationMultiplier = modelConfig
    ? modelConfig.feeMultiplier / 10000
    : DIVINATION_FEE_MULTIPLIER[divinationType] / 10000;

  return BigInt(Math.floor(Number(baseFee) * interpretationMultiplier * divinationMultiplier));
}

/**
 * 计算带有占卜类型倍率的解读费用（本地版本）
 *
 * 使用本地配置的费用倍率进行快速计算
 *
 * @param baseFee 基础费用
 * @param interpretationType 解读类型
 * @param divinationType 占卜类型
 */
export function calculateDivinationInterpretationFeeLocal(
  baseFee: bigint,
  interpretationType: InterpretationType,
  divinationType: DivinationType
): bigint {
  const interpretationMultiplier = INTERPRETATION_FEE_MULTIPLIER[interpretationType];
  const divinationMultiplier = DIVINATION_FEE_MULTIPLIER[divinationType] / 10000;
  return BigInt(Math.floor(Number(baseFee) * interpretationMultiplier * divinationMultiplier));
}

// ==================== Oracle 节点注册服务（新增） ====================

/**
 * 注册成为 Oracle 节点
 *
 * @param name 节点名称
 * @param models 支持的模型列表
 * @param stakeAmount 质押金额
 */
export async function registerOracleNode(
  name: string,
  models: Array<{
    modelId: string;
    version: number;
    supportedTypes: DivinationType[];
    isPrimary: boolean;
  }>,
  stakeAmount: bigint
): Promise<void> {
  const api = await getSignedApi();

  // 转换模型列表格式
  const modelParams = models.map((m) => ({
    modelId: Array.from(new TextEncoder().encode(m.modelId)),
    version: m.version,
    supportedTypes: m.supportedTypes,
    isPrimary: m.isPrimary,
  }));

  const tx = api.tx.divinationAi.registerOracle(
    Array.from(new TextEncoder().encode(name)),
    modelParams,
    stakeAmount.toString()
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status }) => {
      if (status.isInBlock) {
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 更新 Oracle 节点支持的模型
 *
 * @param models 新的模型列表
 */
export async function updateOracleModels(
  models: Array<{
    modelId: string;
    version: number;
    supportedTypes: DivinationType[];
    isPrimary: boolean;
  }>
): Promise<void> {
  const api = await getSignedApi();

  const modelParams = models.map((m) => ({
    modelId: Array.from(new TextEncoder().encode(m.modelId)),
    version: m.version,
    supportedTypes: m.supportedTypes,
    isPrimary: m.isPrimary,
  }));

  const tx = api.tx.divinationAi.updateModelSupport(modelParams);

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status }) => {
      if (status.isInBlock) {
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 注销 Oracle 节点
 */
export async function unregisterOracleNode(): Promise<void> {
  const api = await getSignedApi();
  const tx = api.tx.divinationAi.unregisterOracle();

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status }) => {
      if (status.isInBlock) {
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 暂停 Oracle 节点服务
 */
export async function pauseOracleNode(): Promise<void> {
  const api = await getSignedApi();
  const tx = api.tx.divinationAi.pauseOracle();

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status }) => {
      if (status.isInBlock) {
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 恢复 Oracle 节点服务
 */
export async function resumeOracleNode(): Promise<void> {
  const api = await getSignedApi();
  const tx = api.tx.divinationAi.resumeOracle();

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status }) => {
      if (status.isInBlock) {
        resolve();
      }
    }).catch(reject);
  });
}

// ==================== 服务模块导出 ====================

/**
 * 导出个人主页服务
 *
 * ProfileService 提供服务提供者个人主页管理功能：
 * - 个人资料管理
 * - 资质证书管理
 * - 作品集管理
 * - 技能标签管理
 */
export { ProfileService, createProfileService } from './profileService';

/**
 * 导出占卜市场信用体系服务
 *
 * DivinationCreditService 提供服务提供者信用管理功能：
 * - 信用档案查询和管理
 * - 违规记录管理
 * - 申诉处理
 * - 信用修复任务
 *
 * 注意：此服务与 creditService.ts（OTC 交易信用）是不同的系统
 */
export { DivinationCreditService, createDivinationCreditService } from './divinationCreditService';

/**
 * 导出悬赏问答服务
 *
 * BountyService 提供悬赏问答功能：
 * - 创建悬赏问题
 * - 提交回答
 * - 投票和采纳
 * - 奖励结算
 */
export { BountyService, createBountyService } from './bountyService';
