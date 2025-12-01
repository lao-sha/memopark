/**
 * 梅花易数 NFT 市场页面
 *
 * 功能：
 * - 浏览已上架的卦象 NFT
 * - 购买 NFT
 * - 查看 NFT 详情和稀有度
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, List, Tag, Button, Empty, Spin, Modal, message, Input, Tabs, Space, Typography } from 'antd';
import { ShoppingCartOutlined, FireOutlined, StarOutlined, CrownOutlined, GoldOutlined } from '@ant-design/icons';
import {
  getListedNfts,
  buyNft,
  getNft,
  getNftOffers,
  makeNftOffer,
} from '../../services/meihuaService';
import type { HexagramNft, NftOffer } from '../../types/meihua';
import {
  NftRarity,
  NFT_RARITY_NAMES,
  NFT_RARITY_COLORS,
  TRIGRAM_NAMES,
  TRIGRAM_SYMBOLS,
  Trigram,
} from '../../types/meihua';
import { useWalletStore } from '../../stores/walletStore';
import './NftMarketPage.css';

const { Text, Title } = Typography;
const { Search } = Input;

/** 格式化 DUST 金额显示 */
const formatDust = (amount: bigint): string => {
  const dust = Number(amount) / 1e12;
  return dust.toFixed(2);
};

/** 获取稀有度图标 */
const getRarityIcon = (rarity: NftRarity) => {
  switch (rarity) {
    case NftRarity.Legendary:
      return <CrownOutlined style={{ color: NFT_RARITY_COLORS[rarity] }} />;
    case NftRarity.Epic:
      return <StarOutlined style={{ color: NFT_RARITY_COLORS[rarity] }} />;
    case NftRarity.Rare:
      return <FireOutlined style={{ color: NFT_RARITY_COLORS[rarity] }} />;
    default:
      return <GoldOutlined style={{ color: NFT_RARITY_COLORS[rarity] }} />;
  }
};

/** 获取卦象名称 */
const getHexagramDisplayName = (upperTrigram: number, lowerTrigram: number): string => {
  const upper = TRIGRAM_NAMES[upperTrigram as Trigram] || '?';
  const lower = TRIGRAM_NAMES[lowerTrigram as Trigram] || '?';
  const upperSymbol = TRIGRAM_SYMBOLS[upperTrigram as Trigram] || '';
  const lowerSymbol = TRIGRAM_SYMBOLS[lowerTrigram as Trigram] || '';
  return `${upperSymbol}${lowerSymbol} ${upper}${lower}`;
};

const NftMarketPage: React.FC = () => {
  const { address } = useWalletStore();
  const [listedNfts, setListedNfts] = useState<HexagramNft[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<number | null>(null);
  const [selectedNft, setSelectedNft] = useState<HexagramNft | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offers, setOffers] = useState<NftOffer[]>([]);
  const [searchText, setSearchText] = useState('');
  const [rarityFilter, setRarityFilter] = useState<NftRarity | 'all'>('all');

  /** 加载上架的 NFT 列表 */
  const loadListedNfts = useCallback(async () => {
    setLoading(true);
    try {
      const nfts = await getListedNfts();
      setListedNfts(nfts);
    } catch (error) {
      console.error('加载 NFT 列表失败:', error);
      message.error('加载 NFT 列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadListedNfts();
  }, [loadListedNfts]);

  /** 购买 NFT */
  const handleBuy = async (nftId: number) => {
    if (!address) {
      message.warning('请先连接钱包');
      return;
    }

    setBuying(nftId);
    try {
      await buyNft(nftId);
      message.success('购买成功！');
      loadListedNfts();
    } catch (error) {
      console.error('购买失败:', error);
      message.error('购买失败');
    } finally {
      setBuying(null);
    }
  };

  /** 查看详情 */
  const handleViewDetail = async (nft: HexagramNft) => {
    setSelectedNft(nft);
    setDetailModalVisible(true);

    // 加载出价列表
    try {
      const offerList = await getNftOffers(nft.id);
      setOffers(offerList);
    } catch (error) {
      console.error('加载出价列表失败:', error);
    }
  };

  /** 出价 */
  const handleMakeOffer = async () => {
    if (!selectedNft || !offerAmount) return;

    try {
      const amount = BigInt(Math.floor(parseFloat(offerAmount) * 1e12));
      await makeNftOffer(selectedNft.id, amount);
      message.success('出价成功！');
      setOfferModalVisible(false);
      setOfferAmount('');

      // 刷新出价列表
      const offerList = await getNftOffers(selectedNft.id);
      setOffers(offerList);
    } catch (error) {
      console.error('出价失败:', error);
      message.error('出价失败');
    }
  };

  /** 过滤 NFT 列表 */
  const filteredNfts = listedNfts.filter((nft) => {
    // 搜索过滤
    if (searchText && !nft.name.toLowerCase().includes(searchText.toLowerCase())) {
      return false;
    }
    // 稀有度过滤
    if (rarityFilter !== 'all' && nft.rarity !== rarityFilter) {
      return false;
    }
    return true;
  });

  /** 渲染 NFT 卡片 */
  const renderNftCard = (nft: HexagramNft) => (
    <Card
      className="nft-card"
      hoverable
      onClick={() => handleViewDetail(nft)}
      cover={
        <div
          className="nft-cover"
          style={{ borderColor: NFT_RARITY_COLORS[nft.rarity] }}
        >
          <div className="hexagram-display">
            <span className="trigram upper">
              {TRIGRAM_SYMBOLS[nft.hexagramId % 8 as Trigram]}
            </span>
            <span className="trigram lower">
              {TRIGRAM_SYMBOLS[Math.floor(nft.hexagramId / 8) % 8 as Trigram]}
            </span>
          </div>
          <Tag
            className="rarity-tag"
            color={NFT_RARITY_COLORS[nft.rarity]}
            icon={getRarityIcon(nft.rarity)}
          >
            {NFT_RARITY_NAMES[nft.rarity]}
          </Tag>
        </div>
      }
      actions={[
        <Button
          type="primary"
          icon={<ShoppingCartOutlined />}
          loading={buying === nft.id}
          onClick={(e) => {
            e.stopPropagation();
            handleBuy(nft.id);
          }}
          disabled={nft.owner === address}
        >
          {nft.owner === address ? '我的 NFT' : '购买'}
        </Button>,
      ]}
    >
      <Card.Meta
        title={nft.name}
        description={
          <Space direction="vertical" size={4}>
            <Text type="secondary">
              创作者: {nft.creator.slice(0, 8)}...
            </Text>
            <Text strong style={{ color: '#1890ff', fontSize: '16px' }}>
              {formatDust(nft.listPrice || 0n)} DUST
            </Text>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              版税: {(nft.royaltyRate / 100).toFixed(1)}%
            </Text>
          </Space>
        }
      />
    </Card>
  );

  return (
    <div className="nft-market-page">
      <div className="page-header">
        <Title level={4}>卦象 NFT 市场</Title>
        <Text type="secondary">收集独特的卦象 NFT，稀有度由卦象特征自动判定</Text>
      </div>

      {/* 筛选栏 */}
      <div className="filter-bar">
        <Search
          placeholder="搜索 NFT 名称"
          allowClear
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 200 }}
        />
        <Tabs
          activeKey={String(rarityFilter)}
          onChange={(key) => setRarityFilter(key === 'all' ? 'all' : Number(key) as NftRarity)}
          items={[
            { key: 'all', label: '全部' },
            { key: String(NftRarity.Common), label: '普通' },
            { key: String(NftRarity.Rare), label: '稀有' },
            { key: String(NftRarity.Epic), label: '史诗' },
            { key: String(NftRarity.Legendary), label: '传说' },
          ]}
        />
      </div>

      {/* NFT 列表 */}
      {loading ? (
        <div className="loading-container">
          <Spin size="large" tip="加载中..." />
        </div>
      ) : filteredNfts.length === 0 ? (
        <Empty description="暂无上架的 NFT" />
      ) : (
        <List
          grid={{ gutter: 16, xs: 1, sm: 2, md: 2, lg: 3, xl: 4 }}
          dataSource={filteredNfts}
          renderItem={renderNftCard}
        />
      )}

      {/* NFT 详情弹窗 */}
      <Modal
        title="NFT 详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="offer" onClick={() => setOfferModalVisible(true)}>
            出价
          </Button>,
          <Button
            key="buy"
            type="primary"
            onClick={() => selectedNft && handleBuy(selectedNft.id)}
            disabled={selectedNft?.owner === address}
            loading={buying === selectedNft?.id}
          >
            立即购买
          </Button>,
        ]}
        width={600}
      >
        {selectedNft && (
          <div className="nft-detail">
            <div className="detail-header">
              <div
                className="detail-cover"
                style={{ borderColor: NFT_RARITY_COLORS[selectedNft.rarity] }}
              >
                <div className="hexagram-display large">
                  <span className="trigram">
                    {TRIGRAM_SYMBOLS[selectedNft.hexagramId % 8 as Trigram]}
                  </span>
                  <span className="trigram">
                    {TRIGRAM_SYMBOLS[Math.floor(selectedNft.hexagramId / 8) % 8 as Trigram]}
                  </span>
                </div>
              </div>
              <div className="detail-info">
                <Title level={4}>{selectedNft.name}</Title>
                <Tag
                  color={NFT_RARITY_COLORS[selectedNft.rarity]}
                  icon={getRarityIcon(selectedNft.rarity)}
                >
                  {NFT_RARITY_NAMES[selectedNft.rarity]}
                </Tag>
                <div className="price">
                  <Text strong style={{ fontSize: '24px', color: '#1890ff' }}>
                    {formatDust(selectedNft.listPrice || 0n)} DUST
                  </Text>
                </div>
              </div>
            </div>

            <div className="detail-body">
              <div className="info-row">
                <Text type="secondary">创作者</Text>
                <Text copyable>{selectedNft.creator}</Text>
              </div>
              <div className="info-row">
                <Text type="secondary">当前所有者</Text>
                <Text copyable>{selectedNft.owner}</Text>
              </div>
              <div className="info-row">
                <Text type="secondary">版税比例</Text>
                <Text>{(selectedNft.royaltyRate / 100).toFixed(1)}%</Text>
              </div>
              <div className="info-row">
                <Text type="secondary">转让次数</Text>
                <Text>{selectedNft.transferCount}</Text>
              </div>
              <div className="info-row">
                <Text type="secondary">元数据 CID</Text>
                <Text copyable={{ text: selectedNft.metadataCid }}>
                  {selectedNft.metadataCid.slice(0, 20)}...
                </Text>
              </div>
            </div>

            {/* 出价列表 */}
            {offers.length > 0 && (
              <div className="offers-section">
                <Title level={5}>当前出价</Title>
                <List
                  size="small"
                  dataSource={offers}
                  renderItem={(offer) => (
                    <List.Item>
                      <Text>{offer.bidder.slice(0, 8)}...</Text>
                      <Text strong>{formatDust(offer.amount)} DUST</Text>
                    </List.Item>
                  )}
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 出价弹窗 */}
      <Modal
        title="对此 NFT 出价"
        open={offerModalVisible}
        onCancel={() => {
          setOfferModalVisible(false);
          setOfferAmount('');
        }}
        onOk={handleMakeOffer}
        okText="确认出价"
      >
        <div className="offer-form">
          <Text>请输入您的出价（DUST）：</Text>
          <Input
            type="number"
            value={offerAmount}
            onChange={(e) => setOfferAmount(e.target.value)}
            placeholder="输入出价金额"
            suffix="DUST"
            style={{ marginTop: 12 }}
          />
          {selectedNft?.listPrice && (
            <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
              当前售价: {formatDust(selectedNft.listPrice)} DUST
            </Text>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default NftMarketPage;
