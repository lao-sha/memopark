/**
 * Deceased API服务层
 * 
 * 功能说明：
 * 1. 逝者信息查询和管理
 * 2. 文本内容管理（消息、悼词）
 * 3. 媒体内容管理（相册、视频）
 * 4. Pin状态管理
 * 5. 生命周期管理
 * 
 * 创建日期：2025-10-28
 */

import type { ApiPromise } from '@polkadot/api'
import type { SubmittableExtrinsic } from '@polkadot/api/types'

// ========================================
// TypeScript 接口定义
// ========================================

/**
 * 函数级详细中文注释：逝者性别枚举
 */
export enum Gender {
  Male = 'Male',
  Female = 'Female',
  Other = 'Other',
}

/**
 * 函数级详细中文注释：Pin状态枚举
 */
export enum PinStatus {
  Unpinned = 'Unpinned',       // 未固定
  Pinning = 'Pinning',         // 固定中
  Pinned = 'Pinned',           // 已固定
  PinFailed = 'PinFailed',     // 固定失败
}

/**
 * 函数级详细中文注释：逝者基本信息
 */
export interface DeceasedInfo {
  id: number
  owner: string
  creator: string
  fullName: string
  fullNameCid: string
  birthDate: number
  deathDate: number
  gender: Gender
  mainImageCid: string
  bio: string
  bioCid: string
  
  // Pin状态
  fullNamePinStatus: PinStatus
  mainImagePinStatus: PinStatus
  bioPinStatus: PinStatus
  
  // 生命周期
  lifeYears?: number
  createdAt: number
  updatedAt: number
}

/**
 * 函数级详细中文注释：文本消息
 */
export interface TextMessage {
  id: number
  deceasedId: number
  author: string
  contentCid: string
  tags: string[]
  createdAt: number
  pinStatus: PinStatus
}

/**
 * 函数级详细中文注释：悼词
 */
export interface Eulogy {
  id: number
  deceasedId: number
  author: string
  title: string
  contentCid: string
  createdAt: number
  pinStatus: PinStatus
}

/**
 * 函数级详细中文注释：相册
 */
export interface Album {
  id: number
  deceasedId: number
  name: string
  description: string
  coverCid: string
  photoCount: number
  createdAt: number
  updatedAt: number
  pinStatus: PinStatus
}

/**
 * 函数级详细中文注释：照片
 */
export interface Photo {
  id: number
  albumId: number
  cid: string
  caption: string
  tags: string[]
  takenAt?: number
  uploadedAt: number
  pinStatus: PinStatus
}

/**
 * 函数级详细中文注释：视频集
 */
export interface VideoCollection {
  id: number
  deceasedId: number
  name: string
  description: string
  coverCid: string
  videoCount: number
  createdAt: number
  updatedAt: number
  pinStatus: PinStatus
}

/**
 * 函数级详细中文注释：视频
 */
export interface Video {
  id: number
  collectionId: number
  cid: string
  title: string
  description: string
  duration?: number
  tags: string[]
  uploadedAt: number
  pinStatus: PinStatus
}

/**
 * 函数级详细中文注释：逝者筛选参数
 */
export interface DeceasedFilter {
  owner?: string
  creator?: string
  gender?: Gender
  limit?: number
}

/**
 * 函数级详细中文注释：创建逝者参数
 */
export interface CreateDeceasedParams {
  fullName: string
  fullNameCid: string
  birthDate: number
  deathDate: number
  gender: Gender
  mainImageCid: string
  bio: string
  bioCid: string
}

/**
 * 函数级详细中文注释：更新逝者参数
 */
export interface UpdateDeceasedParams {
  deceasedId: number
  fullName?: string
  fullNameCid?: string
  mainImageCid?: string
  bio?: string
  bioCid?: string
}

/**
 * 函数级详细中文注释：添加文本消息参数
 */
export interface AddMessageParams {
  deceasedId: number
  contentCid: string
  tags: string[]
}

/**
 * 函数级详细中文注释：添加悼词参数
 */
export interface AddEulogyParams {
  deceasedId: number
  title: string
  contentCid: string
}

/**
 * 函数级详细中文注释：创建相册参数
 */
export interface CreateAlbumParams {
  deceasedId: number
  name: string
  description: string
  coverCid: string
}

/**
 * 函数级详细中文注释：添加照片参数
 */
export interface AddPhotoParams {
  albumId: number
  cid: string
  caption: string
  tags: string[]
  takenAt?: number
}

/**
 * 函数级详细中文注释：创建视频集参数
 */
export interface CreateVideoCollectionParams {
  deceasedId: number
  name: string
  description: string
  coverCid: string
}

/**
 * 函数级详细中文注释：添加视频参数
 */
export interface AddVideoParams {
  collectionId: number
  cid: string
  title: string
  description: string
  duration?: number
  tags: string[]
}

// ========================================
// Deceased Service 类
// ========================================

/**
 * 函数级详细中文注释：Deceased API服务类
 */
export class DeceasedService {
  constructor(private api: ApiPromise) {}

  // ========================================
  // 逝者信息查询
  // ========================================

  /**
   * 函数级详细中文注释：查询单个逝者信息
   */
  async getDeceased(id: number): Promise<DeceasedInfo | null> {
    const result = await this.api.query.deceased.deceasedOf(id)
    if (result.isNone) return null

    const data = result.unwrap()
    return {
      id,
      owner: data.owner.toString(),
      creator: data.creator.toString(),
      fullName: this.decodeString(data.fullName),
      fullNameCid: this.decodeString(data.fullNameCid),
      birthDate: data.birthDate.toNumber(),
      deathDate: data.deathDate.toNumber(),
      gender: this.decodeGender(data.gender),
      mainImageCid: this.decodeString(data.mainImageCid),
      bio: this.decodeString(data.bio),
      bioCid: this.decodeString(data.bioCid),
      fullNamePinStatus: this.decodePinStatus(data.fullNamePinStatus),
      mainImagePinStatus: this.decodePinStatus(data.mainImagePinStatus),
      bioPinStatus: this.decodePinStatus(data.bioPinStatus),
      lifeYears: data.lifeYears?.isSome ? data.lifeYears.unwrap().toNumber() : undefined,
      createdAt: data.createdAt.toNumber(),
      updatedAt: data.updatedAt.toNumber(),
    }
  }

  /**
   * 函数级详细中文注释：查询逝者列表
   */
  async listDeceased(filter: DeceasedFilter = {}): Promise<DeceasedInfo[]> {
    const entries = await this.api.query.deceased.deceasedOf.entries()
    let result: DeceasedInfo[] = []

    for (const [key, value] of entries) {
      if (value.isNone) continue
      
      const id = key.args[0].toNumber()
      const deceased = await this.getDeceased(id)
      if (!deceased) continue

      // 应用筛选
      if (filter.owner && deceased.owner !== filter.owner) continue
      if (filter.creator && deceased.creator !== filter.creator) continue
      if (filter.gender && deceased.gender !== filter.gender) continue

      result.push(deceased)
    }

    // 按创建时间倒序排序
    result.sort((a, b) => b.createdAt - a.createdAt)

    // 应用数量限制
    if (filter.limit && filter.limit > 0) {
      result = result.slice(0, filter.limit)
    }

    return result
  }

  /**
   * 函数级详细中文注释：查询逝者的文本消息
   */
  async getMessages(deceasedId: number): Promise<TextMessage[]> {
    const result = await this.api.query.deceased.messagesOf(deceasedId)
    if (!result) return []

    return result.map((msg: any, index: number) => ({
      id: index,
      deceasedId,
      author: msg.author.toString(),
      contentCid: this.decodeString(msg.contentCid),
      tags: msg.tags.map((t: any) => this.decodeString(t)),
      createdAt: msg.createdAt.toNumber(),
      pinStatus: this.decodePinStatus(msg.pinStatus),
    }))
  }

  /**
   * 函数级详细中文注释：查询逝者的悼词
   */
  async getEulogies(deceasedId: number): Promise<Eulogy[]> {
    const result = await this.api.query.deceased.eulogiesOf(deceasedId)
    if (!result) return []

    return result.map((eulogy: any, index: number) => ({
      id: index,
      deceasedId,
      author: eulogy.author.toString(),
      title: this.decodeString(eulogy.title),
      contentCid: this.decodeString(eulogy.contentCid),
      createdAt: eulogy.createdAt.toNumber(),
      pinStatus: this.decodePinStatus(eulogy.pinStatus),
    }))
  }

  /**
   * 函数级详细中文注释：查询逝者的相册
   */
  async getAlbums(deceasedId: number): Promise<Album[]> {
    const result = await this.api.query.deceased.albumsOf(deceasedId)
    if (!result) return []

    return result.map((album: any, index: number) => ({
      id: index,
      deceasedId,
      name: this.decodeString(album.name),
      description: this.decodeString(album.description),
      coverCid: this.decodeString(album.coverCid),
      photoCount: album.photos.length,
      createdAt: album.createdAt.toNumber(),
      updatedAt: album.updatedAt.toNumber(),
      pinStatus: this.decodePinStatus(album.coverPinStatus),
    }))
  }

  /**
   * 函数级详细中文注释：查询相册的照片
   */
  async getPhotos(deceasedId: number, albumId: number): Promise<Photo[]> {
    const albums = await this.getAlbums(deceasedId)
    if (albumId >= albums.length) return []

    const result = await this.api.query.deceased.albumsOf(deceasedId)
    if (!result || !result[albumId]) return []

    const album = result[albumId]
    return album.photos.map((photo: any, index: number) => ({
      id: index,
      albumId,
      cid: this.decodeString(photo.cid),
      caption: this.decodeString(photo.caption),
      tags: photo.tags.map((t: any) => this.decodeString(t)),
      takenAt: photo.takenAt?.isSome ? photo.takenAt.unwrap().toNumber() : undefined,
      uploadedAt: photo.uploadedAt.toNumber(),
      pinStatus: this.decodePinStatus(photo.pinStatus),
    }))
  }

  /**
   * 函数级详细中文注释：查询逝者的视频集
   */
  async getVideoCollections(deceasedId: number): Promise<VideoCollection[]> {
    const result = await this.api.query.deceased.videoCollectionsOf(deceasedId)
    if (!result) return []

    return result.map((collection: any, index: number) => ({
      id: index,
      deceasedId,
      name: this.decodeString(collection.name),
      description: this.decodeString(collection.description),
      coverCid: this.decodeString(collection.coverCid),
      videoCount: collection.videos.length,
      createdAt: collection.createdAt.toNumber(),
      updatedAt: collection.updatedAt.toNumber(),
      pinStatus: this.decodePinStatus(collection.coverPinStatus),
    }))
  }

  /**
   * 函数级详细中文注释：查询视频集的视频
   */
  async getVideos(deceasedId: number, collectionId: number): Promise<Video[]> {
    const collections = await this.getVideoCollections(deceasedId)
    if (collectionId >= collections.length) return []

    const result = await this.api.query.deceased.videoCollectionsOf(deceasedId)
    if (!result || !result[collectionId]) return []

    const collection = result[collectionId]
    return collection.videos.map((video: any, index: number) => ({
      id: index,
      collectionId,
      cid: this.decodeString(video.cid),
      title: this.decodeString(video.title),
      description: this.decodeString(video.description),
      duration: video.duration?.isSome ? video.duration.unwrap().toNumber() : undefined,
      tags: video.tags.map((t: any) => this.decodeString(t)),
      uploadedAt: video.uploadedAt.toNumber(),
      pinStatus: this.decodePinStatus(video.pinStatus),
    }))
  }

  // ========================================
  // 交易构建方法
  // ========================================

  /**
   * 函数级详细中文注释：构建创建逝者交易
   */
  buildCreateDeceasedTx(params: CreateDeceasedParams): SubmittableExtrinsic<'promise'> {
    return this.api.tx.deceased.create(
      params.fullName,
      params.fullNameCid,
      params.birthDate,
      params.deathDate,
      params.gender,
      params.mainImageCid,
      params.bio,
      params.bioCid
    )
  }

  /**
   * 函数级详细中文注释：构建更新逝者交易
   */
  buildUpdateDeceasedTx(params: UpdateDeceasedParams): SubmittableExtrinsic<'promise'> {
    return this.api.tx.deceased.update(
      params.deceasedId,
      params.fullName || null,
      params.fullNameCid || null,
      params.mainImageCid || null,
      params.bio || null,
      params.bioCid || null
    )
  }

  /**
   * 函数级详细中文注释：构建添加文本消息交易
   */
  buildAddMessageTx(params: AddMessageParams): SubmittableExtrinsic<'promise'> {
    return this.api.tx.deceased.addMessage(
      params.deceasedId,
      params.contentCid,
      params.tags
    )
  }

  /**
   * 函数级详细中文注释：构建添加悼词交易
   */
  buildAddEulogyTx(params: AddEulogyParams): SubmittableExtrinsic<'promise'> {
    return this.api.tx.deceased.addEulogy(
      params.deceasedId,
      params.title,
      params.contentCid
    )
  }

  /**
   * 函数级详细中文注释：构建创建相册交易
   */
  buildCreateAlbumTx(params: CreateAlbumParams): SubmittableExtrinsic<'promise'> {
    return this.api.tx.deceased.createAlbum(
      params.deceasedId,
      params.name,
      params.description,
      params.coverCid
    )
  }

  /**
   * 函数级详细中文注释：构建添加照片交易
   */
  buildAddPhotoTx(params: AddPhotoParams): SubmittableExtrinsic<'promise'> {
    return this.api.tx.deceased.addPhoto(
      params.albumId,
      params.cid,
      params.caption,
      params.tags,
      params.takenAt || null
    )
  }

  /**
   * 函数级详细中文注释：构建创建视频集交易
   */
  buildCreateVideoCollectionTx(params: CreateVideoCollectionParams): SubmittableExtrinsic<'promise'> {
    return this.api.tx.deceased.createVideoCollection(
      params.deceasedId,
      params.name,
      params.description,
      params.coverCid
    )
  }

  /**
   * 函数级详细中文注释：构建添加视频交易
   */
  buildAddVideoTx(params: AddVideoParams): SubmittableExtrinsic<'promise'> {
    return this.api.tx.deceased.addVideo(
      params.collectionId,
      params.cid,
      params.title,
      params.description,
      params.duration || null,
      params.tags
    )
  }

  /**
   * 函数级详细中文注释：构建删除逝者交易（仅创建者）
   */
  buildDeleteDeceasedTx(deceasedId: number): SubmittableExtrinsic<'promise'> {
    return this.api.tx.deceased.delete(deceasedId)
  }

  /**
   * 函数级详细中文注释：构建转移所有权交易
   */
  buildTransferOwnershipTx(deceasedId: number, newOwner: string): SubmittableExtrinsic<'promise'> {
    return this.api.tx.deceased.transferOwnership(deceasedId, newOwner)
  }

  // ========================================
  // 辅助方法
  // ========================================

  /**
   * 函数级详细中文注释：解码字符串（BoundedVec<u8>）
   */
  private decodeString(bounded: any): string {
    try {
      return new TextDecoder().decode(new Uint8Array(bounded))
    } catch {
      return ''
    }
  }

  /**
   * 函数级详细中文注释：解码性别枚举
   */
  private decodeGender(gender: any): Gender {
    if (gender.isMale) return Gender.Male
    if (gender.isFemale) return Gender.Female
    return Gender.Other
  }

  /**
   * 函数级详细中文注释：解码Pin状态
   */
  private decodePinStatus(status: any): PinStatus {
    if (status.isUnpinned) return PinStatus.Unpinned
    if (status.isPinning) return PinStatus.Pinning
    if (status.isPinned) return PinStatus.Pinned
    if (status.isPinFailed) return PinStatus.PinFailed
    return PinStatus.Unpinned
  }
}

/**
 * 函数级详细中文注释：创建 DeceasedService 实例
 */
export function createDeceasedService(api: ApiPromise): DeceasedService {
  return new DeceasedService(api)
}

