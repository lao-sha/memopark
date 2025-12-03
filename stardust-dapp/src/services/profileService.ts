/**
 * 个人主页服务
 *
 * 提供服务提供者个人主页管理的链上交互接口
 * - 个人资料管理
 * - 资质证书管理
 * - 作品集管理
 * - 技能标签管理
 */

import { ApiPromise } from '@polkadot/api';
import type { InjectedExtension } from '@polkadot/extension-inject/types';
import {
  ProviderProfile,
  Certificate,
  CertificateType,
  PortfolioItem,
  PortfolioCaseType,
  SkillTag,
  SkillTagType,
  ReviewTagStats,
  DivinationType,
} from '../types/divination';

/**
 * 个人主页服务类
 *
 * 封装与 pallet-divination-market 个人主页相关的链上交互
 */
export class ProfileService {
  private api: ApiPromise;
  private extension: InjectedExtension | null = null;

  constructor(api: ApiPromise, extension?: InjectedExtension) {
    this.api = api;
    if (extension) {
      this.extension = extension;
    }
  }

  /**
   * 设置签名扩展
   */
  setExtension(extension: InjectedExtension): void {
    this.extension = extension;
  }

  // ==================== 个人资料管理 ====================

  /**
   * 更新个人详细资料
   *
   * @param params 资料参数
   * @param signer 签名账户地址
   */
  async updateProfile(
    params: {
      introductionCid?: string;
      experienceYears?: number;
      background?: string;
      motto?: string;
      expertiseDescription?: string;
      workingHours?: string;
      avgResponseTime?: number;
      acceptsAppointment?: boolean;
      bannerCid?: string;
    },
    signer: string
  ): Promise<string> {
    if (!this.extension) {
      throw new Error('Extension not connected');
    }

    const tx = this.api.tx.divinationMarket.updateProfile(
      params.introductionCid || null,
      params.experienceYears || null,
      params.background || null,
      params.motto || null,
      params.expertiseDescription || null,
      params.workingHours || null,
      params.avgResponseTime || null,
      params.acceptsAppointment ?? null,
      params.bannerCid || null
    );

    const injector = await this.extension.signer;
    const hash = await tx.signAndSend(signer, { signer: injector });
    return hash.toHex();
  }

  /**
   * 获取提供者详细资料
   *
   * @param account 提供者账户地址
   */
  async getProviderProfile(account: string): Promise<ProviderProfile | null> {
    const result = await this.api.query.divinationMarket.providerProfiles(account);

    if (result.isEmpty) {
      return null;
    }

    const data = result.toJSON() as any;
    return {
      introductionCid: data.introductionCid ? this.hexToString(data.introductionCid) : undefined,
      experienceYears: data.experienceYears,
      background: data.background ? this.hexToString(data.background) : undefined,
      motto: data.motto ? this.hexToString(data.motto) : undefined,
      expertiseDescription: data.expertiseDescription
        ? this.hexToString(data.expertiseDescription)
        : undefined,
      workingHours: data.workingHours ? this.hexToString(data.workingHours) : undefined,
      avgResponseTime: data.avgResponseTime,
      acceptsAppointment: data.acceptsAppointment,
      bannerCid: data.bannerCid ? this.hexToString(data.bannerCid) : undefined,
      updatedAt: data.updatedAt,
    };
  }

  // ==================== 资质证书管理 ====================

  /**
   * 添加资质证书
   *
   * @param params 证书参数
   * @param signer 签名账户地址
   */
  async addCertificate(
    params: {
      name: string;
      certType: CertificateType;
      issuer?: string;
      imageCid: string;
      issuedAt?: number;
    },
    signer: string
  ): Promise<string> {
    if (!this.extension) {
      throw new Error('Extension not connected');
    }

    const tx = this.api.tx.divinationMarket.addCertificate(
      params.name,
      params.certType,
      params.issuer || null,
      params.imageCid,
      params.issuedAt || null
    );

    const injector = await this.extension.signer;
    const hash = await tx.signAndSend(signer, { signer: injector });
    return hash.toHex();
  }

  /**
   * 删除资质证书
   *
   * @param certificateId 证书 ID
   * @param signer 签名账户地址
   */
  async removeCertificate(certificateId: number, signer: string): Promise<string> {
    if (!this.extension) {
      throw new Error('Extension not connected');
    }

    const tx = this.api.tx.divinationMarket.removeCertificate(certificateId);

    const injector = await this.extension.signer;
    const hash = await tx.signAndSend(signer, { signer: injector });
    return hash.toHex();
  }

  /**
   * 获取提供者的所有证书
   *
   * @param account 提供者账户地址
   */
  async getCertificates(account: string): Promise<Certificate[]> {
    const certificates: Certificate[] = [];

    // 获取下一个证书 ID 以确定范围
    const nextId = await this.api.query.divinationMarket.nextCertificateId(account);
    const maxId = (nextId.toJSON() as number) || 0;

    for (let i = 0; i < maxId; i++) {
      const result = await this.api.query.divinationMarket.certificates(account, i);
      if (!result.isEmpty) {
        const data = result.toJSON() as any;
        certificates.push({
          id: data.id,
          name: this.hexToString(data.name),
          certType: data.certType as CertificateType,
          issuer: data.issuer ? this.hexToString(data.issuer) : undefined,
          imageCid: this.hexToString(data.imageCid),
          issuedAt: data.issuedAt,
          isVerified: data.isVerified,
          uploadedAt: data.uploadedAt,
        });
      }
    }

    return certificates;
  }

  /**
   * 获取单个证书
   *
   * @param account 提供者账户地址
   * @param certificateId 证书 ID
   */
  async getCertificate(account: string, certificateId: number): Promise<Certificate | null> {
    const result = await this.api.query.divinationMarket.certificates(account, certificateId);

    if (result.isEmpty) {
      return null;
    }

    const data = result.toJSON() as any;
    return {
      id: data.id,
      name: this.hexToString(data.name),
      certType: data.certType as CertificateType,
      issuer: data.issuer ? this.hexToString(data.issuer) : undefined,
      imageCid: this.hexToString(data.imageCid),
      issuedAt: data.issuedAt,
      isVerified: data.isVerified,
      uploadedAt: data.uploadedAt,
    };
  }

  // ==================== 作品集管理 ====================

  /**
   * 发布作品/案例
   *
   * @param params 作品参数
   * @param signer 签名账户地址
   */
  async publishPortfolio(
    params: {
      title: string;
      divinationType: DivinationType;
      caseType: PortfolioCaseType;
      contentCid: string;
      coverCid?: string;
      isFeatured: boolean;
    },
    signer: string
  ): Promise<string> {
    if (!this.extension) {
      throw new Error('Extension not connected');
    }

    const tx = this.api.tx.divinationMarket.publishPortfolio(
      params.title,
      params.divinationType,
      params.caseType,
      params.contentCid,
      params.coverCid || null,
      params.isFeatured
    );

    const injector = await this.extension.signer;
    const hash = await tx.signAndSend(signer, { signer: injector });
    return hash.toHex();
  }

  /**
   * 更新作品
   *
   * @param params 更新参数
   * @param signer 签名账户地址
   */
  async updatePortfolio(
    params: {
      portfolioId: number;
      title?: string;
      contentCid?: string;
      coverCid?: string;
      isFeatured?: boolean;
    },
    signer: string
  ): Promise<string> {
    if (!this.extension) {
      throw new Error('Extension not connected');
    }

    const tx = this.api.tx.divinationMarket.updatePortfolio(
      params.portfolioId,
      params.title || null,
      params.contentCid || null,
      params.coverCid || null,
      params.isFeatured ?? null
    );

    const injector = await this.extension.signer;
    const hash = await tx.signAndSend(signer, { signer: injector });
    return hash.toHex();
  }

  /**
   * 删除作品
   *
   * @param portfolioId 作品 ID
   * @param signer 签名账户地址
   */
  async removePortfolio(portfolioId: number, signer: string): Promise<string> {
    if (!this.extension) {
      throw new Error('Extension not connected');
    }

    const tx = this.api.tx.divinationMarket.removePortfolio(portfolioId);

    const injector = await this.extension.signer;
    const hash = await tx.signAndSend(signer, { signer: injector });
    return hash.toHex();
  }

  /**
   * 点赞作品
   *
   * @param provider 提供者账户地址
   * @param portfolioId 作品 ID
   * @param signer 签名账户地址
   */
  async likePortfolio(
    provider: string,
    portfolioId: number,
    signer: string
  ): Promise<string> {
    if (!this.extension) {
      throw new Error('Extension not connected');
    }

    const tx = this.api.tx.divinationMarket.likePortfolio(provider, portfolioId);

    const injector = await this.extension.signer;
    const hash = await tx.signAndSend(signer, { signer: injector });
    return hash.toHex();
  }

  /**
   * 获取提供者的所有作品
   *
   * @param account 提供者账户地址
   */
  async getPortfolios(account: string): Promise<PortfolioItem[]> {
    const portfolios: PortfolioItem[] = [];

    // 获取下一个作品 ID 以确定范围
    const nextId = await this.api.query.divinationMarket.nextPortfolioId(account);
    const maxId = (nextId.toJSON() as number) || 0;

    for (let i = 0; i < maxId; i++) {
      const result = await this.api.query.divinationMarket.portfolios(account, i);
      if (!result.isEmpty) {
        const data = result.toJSON() as any;
        portfolios.push({
          id: data.id,
          title: this.hexToString(data.title),
          divinationType: data.divinationType as DivinationType,
          caseType: data.caseType as PortfolioCaseType,
          contentCid: this.hexToString(data.contentCid),
          coverCid: data.coverCid ? this.hexToString(data.coverCid) : undefined,
          isFeatured: data.isFeatured,
          viewCount: data.viewCount,
          likeCount: data.likeCount,
          publishedAt: data.publishedAt,
        });
      }
    }

    return portfolios;
  }

  /**
   * 获取单个作品
   *
   * @param account 提供者账户地址
   * @param portfolioId 作品 ID
   */
  async getPortfolio(account: string, portfolioId: number): Promise<PortfolioItem | null> {
    const result = await this.api.query.divinationMarket.portfolios(account, portfolioId);

    if (result.isEmpty) {
      return null;
    }

    const data = result.toJSON() as any;
    return {
      id: data.id,
      title: this.hexToString(data.title),
      divinationType: data.divinationType as DivinationType,
      caseType: data.caseType as PortfolioCaseType,
      contentCid: this.hexToString(data.contentCid),
      coverCid: data.coverCid ? this.hexToString(data.coverCid) : undefined,
      isFeatured: data.isFeatured,
      viewCount: data.viewCount,
      likeCount: data.likeCount,
      publishedAt: data.publishedAt,
    };
  }

  /**
   * 检查是否已点赞作品
   *
   * @param provider 提供者账户地址
   * @param portfolioId 作品 ID
   * @param user 用户账户地址
   */
  async hasLikedPortfolio(
    provider: string,
    portfolioId: number,
    user: string
  ): Promise<boolean> {
    const result = await this.api.query.divinationMarket.portfolioLikes(
      [provider, portfolioId],
      user
    );
    return result.toJSON() as boolean;
  }

  // ==================== 技能标签管理 ====================

  /**
   * 设置技能标签
   *
   * @param tags 标签列表
   * @param signer 签名账户地址
   */
  async setSkillTags(
    tags: Array<{ label: string; tagType: SkillTagType; proficiency: number }>,
    signer: string
  ): Promise<string> {
    if (!this.extension) {
      throw new Error('Extension not connected');
    }

    const tagsParam = tags.map(tag => [tag.label, tag.tagType, tag.proficiency]);
    const tx = this.api.tx.divinationMarket.setSkillTags(tagsParam);

    const injector = await this.extension.signer;
    const hash = await tx.signAndSend(signer, { signer: injector });
    return hash.toHex();
  }

  /**
   * 获取提供者的技能标签
   *
   * @param account 提供者账户地址
   */
  async getSkillTags(account: string): Promise<SkillTag[]> {
    const result = await this.api.query.divinationMarket.skillTags(account);

    if (result.isEmpty) {
      return [];
    }

    const data = result.toJSON() as any[];
    return data.map(tag => ({
      label: this.hexToString(tag.label),
      tagType: tag.tagType as SkillTagType,
      proficiency: tag.proficiency,
    }));
  }

  // ==================== 评价标签统计 ====================

  /**
   * 获取提供者的评价标签统计
   *
   * @param account 提供者账户地址
   */
  async getReviewTagStats(account: string): Promise<ReviewTagStats> {
    const result = await this.api.query.divinationMarket.reviewTagStatistics(account);

    if (result.isEmpty) {
      return {
        accurateCount: 0,
        friendlyCount: 0,
        quickResponseCount: 0,
        professionalCount: 0,
        patientCount: 0,
        valueForMoneyCount: 0,
      };
    }

    const data = result.toJSON() as any;
    return {
      accurateCount: data.accurateCount,
      friendlyCount: data.friendlyCount,
      quickResponseCount: data.quickResponseCount,
      professionalCount: data.professionalCount,
      patientCount: data.patientCount,
      valueForMoneyCount: data.valueForMoneyCount,
    };
  }

  // ==================== 辅助方法 ====================

  /**
   * 将十六进制字符串转换为普通字符串
   */
  private hexToString(hex: string): string {
    if (!hex || hex === '0x') return '';
    // 移除 0x 前缀
    const hexStr = hex.startsWith('0x') ? hex.slice(2) : hex;
    // 转换为字节数组
    const bytes = [];
    for (let i = 0; i < hexStr.length; i += 2) {
      bytes.push(parseInt(hexStr.substr(i, 2), 16));
    }
    // 使用 TextDecoder 解码为 UTF-8 字符串
    return new TextDecoder().decode(new Uint8Array(bytes));
  }

  /**
   * 获取提供者完整的个人主页数据
   *
   * @param account 提供者账户地址
   */
  async getFullProfile(account: string): Promise<{
    profile: ProviderProfile | null;
    certificates: Certificate[];
    portfolios: PortfolioItem[];
    skillTags: SkillTag[];
    reviewTagStats: ReviewTagStats;
  }> {
    const [profile, certificates, portfolios, skillTags, reviewTagStats] = await Promise.all([
      this.getProviderProfile(account),
      this.getCertificates(account),
      this.getPortfolios(account),
      this.getSkillTags(account),
      this.getReviewTagStats(account),
    ]);

    return {
      profile,
      certificates,
      portfolios,
      skillTags,
      reviewTagStats,
    };
  }

  /**
   * 获取精选作品（按点赞数排序）
   *
   * @param account 提供者账户地址
   * @param limit 返回数量限制
   */
  async getFeaturedPortfolios(account: string, limit: number = 5): Promise<PortfolioItem[]> {
    const portfolios = await this.getPortfolios(account);

    // 先筛选精选作品，然后按点赞数排序
    const featured = portfolios
      .filter(p => p.isFeatured)
      .sort((a, b) => b.likeCount - a.likeCount);

    // 如果精选不足，补充非精选但点赞多的作品
    if (featured.length < limit) {
      const nonFeatured = portfolios
        .filter(p => !p.isFeatured)
        .sort((a, b) => b.likeCount - a.likeCount)
        .slice(0, limit - featured.length);
      featured.push(...nonFeatured);
    }

    return featured.slice(0, limit);
  }

  /**
   * 获取已验证的证书
   *
   * @param account 提供者账户地址
   */
  async getVerifiedCertificates(account: string): Promise<Certificate[]> {
    const certificates = await this.getCertificates(account);
    return certificates.filter(cert => cert.isVerified);
  }
}

/**
 * 创建个人主页服务实例
 */
export function createProfileService(
  api: ApiPromise,
  extension?: InjectedExtension
): ProfileService {
  return new ProfileService(api, extension);
}
