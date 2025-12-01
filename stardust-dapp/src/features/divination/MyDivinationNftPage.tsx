/**
 * 我的占卜 NFT 管理页面
 *
 * 功能：
 * - 查看自己拥有的占卜 NFT
 * - 上架/下架 NFT
 * - 管理出价
 * - 转移 NFT
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Tag,
  Button,
  Empty,
  Spin,
  Modal,
  message,
  Input,
  Tabs,
  Space,
  Typography,
  Statistic,
  Row,
  Col,
} from 'antd';
import {
  GiftOutlined,
  ShopOutlined,
  StopOutlined,
  FireOutlined,
  StarOutlined,
  CrownOutlined,
  GoldOutlined,
} from '@ant-design/icons';
import {
  getUserDivinationNfts,
  listDivinationNft,
  cancelDivinationNftListing,
  transferDivinationNft,
  getDivinationNftOffers,
  acceptDivinationNftOffer,
} from '../../services/divinationService';
import type { DivinationNft, NftOffer } from '../../types/divination';
import {
  DivinationType,
  Rarity,
  DIVINATION_TYPE_NAMES,
  DIVINATION_TYPE_ICONS,
  RARITY_NAMES,
  RARITY_COLORS,
} from '../../types/divination';
import { useWalletStore } from '../../stores/walletStore';
import './DivinationPage.css';

const { Text, Title } = Typography;

/**
 * 格式化 DUST 金额显示
 */
const formatDust = (amount: bigint): string => {
  const dust = Number(amount) / 1e12;
  return dust.toFixed(2);
};

/**
 * 获取稀有度图标
 */
const getRarityIcon = (rarity: Rarity) => {
  switch (rarity) {
    case Rarity.Legendary:
      return <CrownOutlined style={{ color: RARITY_COLORS[rarity] }} />;
    case Rarity.Epic:
      return <StarOutlined style={{ color: RARITY_COLORS[rarity] }} />;
    case Rarity.Rare:
      return <FireOutlined style={{ color: RARITY_COLORS[rarity] }} />;
    default:
      return <GoldOutlined style={{ color: RARITY_COLORS[rarity] }} />;
  }
};

/**
 * 我的占卜 NFT 管理页面
 */
const MyDivinationNftPage: React.FC = () => {
  const { address } = useWalletStore();
  const [nfts, setNfts] = useState<DivinationNft[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<DivinationType | 'all'>('all');

  // 操作状态
  const [selectedNft, setSelectedNft] = useState<DivinationNft | null>(null);
  const [listModalVisible, setListModalVisible] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [offersModalVisible, setOffersModalVisible] = useState(false);
  const [listPrice, setListPrice] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [offers, setOffers] = useState<NftOffer[]>([]);
  const [operating, setOperating] = useState(false);

  /**
   * 加载用户的 NFT 列表
   */
  const loadMyNfts = useCallback(async () => {
    if (!address) {
      setNfts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const divinationType = typeFilter === 'all' ? undefined : typeFilter;
      const userNfts = await getUserDivinationNfts(address, divinationType);
      setNfts(userNfts);
    } catch (error) {
      console.error('加载 NFT 列表失败:', error);
      message.error('加载 NFT 列表失败');
    } finally {
      setLoading(false);
    }
  }, [address, typeFilter]);

  useEffect(() => {
    loadMyNfts();
  }, [loadMyNfts]);

  /**
   * 上架 NFT
   */
  const handleList = async () => {
    if (!selectedNft || !listPrice) return;

    setOperating(true);
    try {
      const price = BigInt(Math.floor(parseFloat(listPrice) * 1e12));
      await listDivinationNft(selectedNft.id, price);
      message.success('上架成功！');
      setListModalVisible(false);
      setListPrice('');
      loadMyNfts();
    } catch (error) {
      console.error('上架失败:', error);
      message.error('上架失败');
    } finally {
      setOperating(false);
    }
  };

  /**
   * 下架 NFT
   */
  const handleCancelListing = async (nftId: number) => {
    setOperating(true);
    try {
      await cancelDivinationNftListing(nftId);
      message.success('下架成功！');
      loadMyNfts();
    } catch (error) {
      console.error('下架失败:', error);
      message.error('下架失败');
    } finally {
      setOperating(false);
    }
  };

  /**
   * 转移 NFT
   */
  const handleTransfer = async () => {
    if (!selectedNft || !transferTo) return;

    setOperating(true);
    try {
      await transferDivinationNft(selectedNft.id, transferTo);
      message.success('转移成功！');
      setTransferModalVisible(false);
      setTransferTo('');
      loadMyNfts();
    } catch (error) {
      console.error('转移失败:', error);
      message.error('转移失败');
    } finally {
      setOperating(false);
    }
  };

  /**
   * 查看出价
   */
  const handleViewOffers = async (nft: DivinationNft) => {
    setSelectedNft(nft);
    setOffersModalVisible(true);

    try {
      const offerList = await getDivinationNftOffers(nft.id);
      setOffers(offerList);
    } catch (error) {
      console.error('加载出价失败:', error);
    }
  };

  /**
   * 接受出价
   */
  const handleAcceptOffer = async (offerId: number) => {
    setOperating(true);
    try {
      await acceptDivinationNftOffer(offerId);
      message.success('已接受出价！');
      setOffersModalVisible(false);
      loadMyNfts();
    } catch (error) {
      console.error('接受出价失败:', error);
      message.error('接受出价失败');
    } finally {
      setOperating(false);
    }
  };

  /**
   * 占卜类型标签页
   */
  const typeTabItems = [
    { key: 'all', label: '全部' },
    ...Object.values(DivinationType)
      .filter((v) => typeof v === 'number')
      .map((t) => ({
        key: String(t),
        label: `${DIVINATION_TYPE_ICONS[t as DivinationType]} ${DIVINATION_TYPE_NAMES[t as DivinationType]}`,
      })),
  ];

  /**
   * 统计数据
   */
  const stats = {
    total: nfts.length,
    listed: nfts.filter(n => n.isListed).length,
    legendary: nfts.filter(n => n.rarity === Rarity.Legendary).length,
    epic: nfts.filter(n => n.rarity === Rarity.Epic).length,
  };

  if (!address) {
    return (
      <div className="my-divination-nft-page">
        <Empty description="请先连接钱包" />
      </div>
    );
  }

  return (
    <div className="my-divination-nft-page">
      <div className="page-header">
        <Title level={4}>📦 我的占卜 NFT</Title>
        <Text type="secondary">管理您收集的占卜 NFT</Text>
      </div>

      {/* 统计数据 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} className="stats-row">
          <Col span={6}>
            <Statistic title="总数" value={stats.total} />
          </Col>
          <Col span={6}>
            <Statistic title="已上架" value={stats.listed} />
          </Col>
          <Col span={6}>
            <Statistic
              title="传说"
              value={stats.legendary}
              valueStyle={{ color: RARITY_COLORS[Rarity.Legendary] }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="史诗"
              value={stats.epic}
              valueStyle={{ color: RARITY_COLORS[Rarity.Epic] }}
            />
          </Col>
        </Row>
      </Card>

      {/* 类型筛选 */}
      <div className="filter-bar">
        <Tabs
          activeKey={String(typeFilter)}
          onChange={(key) => setTypeFilter(key === 'all' ? 'all' : parseInt(key, 10) as DivinationType)}
          items={typeTabItems}
        />
      </div>

      {/* NFT 列表 */}
      {loading ? (
        <div className="loading-container">
          <Spin size="large" tip="加载中..." />
        </div>
      ) : nfts.length === 0 ? (
        <Empty
          description={
            typeFilter !== 'all'
              ? `暂无${DIVINATION_TYPE_NAMES[typeFilter]}类型的 NFT`
              : '您还没有占卜 NFT'
          }
        >
          <Button type="primary" onClick={() => window.location.hash = '#/divination/nft'}>
            去市场看看
          </Button>
        </Empty>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }}>
          {nfts.map((nft) => (
            <Card key={nft.id} className="nft-card">
              <div className="nft-card-content">
                <div
                  className="nft-preview"
                  style={{ borderColor: RARITY_COLORS[nft.rarity] }}
                >
                  <span className="symbol" style={{ fontSize: 24 }}>
                    {DIVINATION_TYPE_ICONS[nft.divinationType]}
                  </span>
                </div>
                <div className="nft-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text strong>{nft.name}</Text>
                    <Tag
                      color={RARITY_COLORS[nft.rarity]}
                      icon={getRarityIcon(nft.rarity)}
                    >
                      {RARITY_NAMES[nft.rarity]}
                    </Tag>
                    <Tag color="purple">
                      {DIVINATION_TYPE_NAMES[nft.divinationType]}
                    </Tag>
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    #{nft.id} · 版税 {(nft.royaltyRate / 100).toFixed(1)}% · 转让 {nft.transferCount} 次
                  </Text>
                  {nft.isListed && (
                    <div style={{ marginTop: 4 }}>
                      <Tag color="green">
                        已上架: {formatDust(nft.listPrice || 0n)} DUST
                      </Tag>
                    </div>
                  )}
                </div>
              </div>
              <div className="nft-actions">
                {nft.isListed ? (
                  <Button
                    icon={<StopOutlined />}
                    onClick={() => handleCancelListing(nft.id)}
                    loading={operating}
                  >
                    下架
                  </Button>
                ) : (
                  <Button
                    type="primary"
                    icon={<ShopOutlined />}
                    onClick={() => {
                      setSelectedNft(nft);
                      setListModalVisible(true);
                    }}
                  >
                    上架
                  </Button>
                )}
                <Button
                  icon={<GiftOutlined />}
                  onClick={() => {
                    setSelectedNft(nft);
                    setTransferModalVisible(true);
                  }}
                >
                  转移
                </Button>
                <Button onClick={() => handleViewOffers(nft)}>
                  查看出价
                </Button>
              </div>
            </Card>
          ))}
        </Space>
      )}

      {/* 上架弹窗 */}
      <Modal
        title="上架 NFT"
        open={listModalVisible}
        onCancel={() => {
          setListModalVisible(false);
          setListPrice('');
        }}
        onOk={handleList}
        okText="确认上架"
        confirmLoading={operating}
      >
        <div>
          <Text>请输入上架价格（DUST）：</Text>
          <Input
            type="number"
            value={listPrice}
            onChange={(e) => setListPrice(e.target.value)}
            placeholder="输入价格"
            suffix="DUST"
            style={{ marginTop: 12 }}
          />
        </div>
      </Modal>

      {/* 转移弹窗 */}
      <Modal
        title="转移 NFT"
        open={transferModalVisible}
        onCancel={() => {
          setTransferModalVisible(false);
          setTransferTo('');
        }}
        onOk={handleTransfer}
        okText="确认转移"
        confirmLoading={operating}
      >
        <div>
          <Text>请输入接收地址：</Text>
          <Input
            value={transferTo}
            onChange={(e) => setTransferTo(e.target.value)}
            placeholder="输入接收者地址"
            style={{ marginTop: 12 }}
          />
          <Text type="warning" style={{ display: 'block', marginTop: 8 }}>
            ⚠️ 转移后将无法撤回，请确认地址正确
          </Text>
        </div>
      </Modal>

      {/* 出价列表弹窗 */}
      <Modal
        title="当前出价"
        open={offersModalVisible}
        onCancel={() => setOffersModalVisible(false)}
        footer={null}
      >
        {offers.length === 0 ? (
          <Empty description="暂无出价" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            {offers.map((offer) => (
              <Card key={offer.id} size="small">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text type="secondary">{offer.bidder.slice(0, 12)}...</Text>
                    <br />
                    <Text strong style={{ fontSize: 16 }}>
                      {formatDust(offer.amount)} DUST
                    </Text>
                  </div>
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => handleAcceptOffer(offer.id)}
                    loading={operating}
                  >
                    接受
                  </Button>
                </div>
              </Card>
            ))}
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default MyDivinationNftPage;
