/**
 * 我的 NFT 页面
 *
 * 功能：
 * - 查看用户拥有的 NFT
 * - 上架/下架 NFT
 * - 铸造新 NFT
 * - 转移 NFT
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, List, Tag, Button, Empty, Spin, Modal, message, Input, Space, Typography, Tabs, Form, InputNumber } from 'antd';
import { PlusOutlined, ShopOutlined, SendOutlined, GiftOutlined, CrownOutlined, StarOutlined, FireOutlined, GoldOutlined } from '@ant-design/icons';
import {
  getUserNfts,
  getNft,
  listNft,
  cancelNftListing,
  transferNft,
  mintNft,
  getUserHexagrams,
  getHexagram,
} from '../../services/meihuaService';
import type { HexagramNft, Hexagram } from '../../types/meihua';
import {
  NftRarity,
  NFT_RARITY_NAMES,
  NFT_RARITY_COLORS,
  TRIGRAM_SYMBOLS,
  Trigram,
} from '../../types/meihua';
import { useWalletStore } from '../../stores/walletStore';
import './MyNftPage.css';

const { Text, Title } = Typography;

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

const MyNftPage: React.FC = () => {
  const { address } = useWalletStore();
  const [myNfts, setMyNfts] = useState<HexagramNft[]>([]);
  const [myHexagrams, setMyHexagrams] = useState<Hexagram[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('owned');

  // 上架弹窗
  const [listModalVisible, setListModalVisible] = useState(false);
  const [selectedNft, setSelectedNft] = useState<HexagramNft | null>(null);
  const [listPrice, setListPrice] = useState('');
  const [listing, setListing] = useState(false);

  // 转移弹窗
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [transferTo, setTransferTo] = useState('');
  const [transferring, setTransferring] = useState(false);

  // 铸造弹窗
  const [mintModalVisible, setMintModalVisible] = useState(false);
  const [mintForm] = Form.useForm();
  const [minting, setMinting] = useState(false);
  const [selectedHexagram, setSelectedHexagram] = useState<Hexagram | null>(null);

  /** 加载用户的 NFT */
  const loadMyNfts = useCallback(async () => {
    if (!address) return;

    setLoading(true);
    try {
      const nftIds = await getUserNfts(address);
      const nfts: HexagramNft[] = [];
      for (const id of nftIds) {
        const nft = await getNft(id);
        if (nft) nfts.push(nft);
      }
      setMyNfts(nfts);
    } catch (error) {
      console.error('加载 NFT 失败:', error);
      message.error('加载 NFT 失败');
    } finally {
      setLoading(false);
    }
  }, [address]);

  /** 加载用户的卦象（用于铸造） */
  const loadMyHexagrams = useCallback(async () => {
    if (!address) return;

    try {
      const hexagramIds = await getUserHexagrams(address);
      const hexagrams: Hexagram[] = [];
      for (const id of hexagramIds) {
        const hex = await getHexagram(id);
        if (hex) hexagrams.push(hex);
      }
      setMyHexagrams(hexagrams);
    } catch (error) {
      console.error('加载卦象失败:', error);
    }
  }, [address]);

  useEffect(() => {
    loadMyNfts();
    loadMyHexagrams();
  }, [loadMyNfts, loadMyHexagrams]);

  /** 上架 NFT */
  const handleList = async () => {
    if (!selectedNft || !listPrice) return;

    setListing(true);
    try {
      const price = BigInt(Math.floor(parseFloat(listPrice) * 1e12));
      await listNft(selectedNft.id, price);
      message.success('上架成功！');
      setListModalVisible(false);
      setListPrice('');
      loadMyNfts();
    } catch (error) {
      console.error('上架失败:', error);
      message.error('上架失败');
    } finally {
      setListing(false);
    }
  };

  /** 下架 NFT */
  const handleCancelListing = async (nft: HexagramNft) => {
    try {
      await cancelNftListing(nft.id);
      message.success('下架成功！');
      loadMyNfts();
    } catch (error) {
      console.error('下架失败:', error);
      message.error('下架失败');
    }
  };

  /** 转移 NFT */
  const handleTransfer = async () => {
    if (!selectedNft || !transferTo) return;

    setTransferring(true);
    try {
      await transferNft(selectedNft.id, transferTo);
      message.success('转移成功！');
      setTransferModalVisible(false);
      setTransferTo('');
      loadMyNfts();
    } catch (error) {
      console.error('转移失败:', error);
      message.error('转移失败');
    } finally {
      setTransferring(false);
    }
  };

  /** 铸造 NFT */
  const handleMint = async (values: any) => {
    if (!selectedHexagram) return;

    setMinting(true);
    try {
      const nftId = await mintNft(
        selectedHexagram.id,
        values.name,
        values.metadataCid || '',
        values.royaltyRate * 100  // 转为万分比
      );
      message.success(`铸造成功！NFT ID: ${nftId}`);
      setMintModalVisible(false);
      mintForm.resetFields();
      setSelectedHexagram(null);
      loadMyNfts();
    } catch (error) {
      console.error('铸造失败:', error);
      message.error('铸造失败');
    } finally {
      setMinting(false);
    }
  };

  /** 打开上架弹窗 */
  const openListModal = (nft: HexagramNft) => {
    setSelectedNft(nft);
    setListModalVisible(true);
  };

  /** 打开转移弹窗 */
  const openTransferModal = (nft: HexagramNft) => {
    setSelectedNft(nft);
    setTransferModalVisible(true);
  };

  /** 打开铸造弹窗 */
  const openMintModal = (hexagram: Hexagram) => {
    setSelectedHexagram(hexagram);
    setMintModalVisible(true);
  };

  /** 渲染 NFT 卡片 */
  const renderNftCard = (nft: HexagramNft) => (
    <Card
      className="my-nft-card"
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
          {nft.isListed && (
            <Tag className="listed-tag" color="green">已上架</Tag>
          )}
        </div>
      }
    >
      <Card.Meta
        title={nft.name}
        description={
          <Space direction="vertical" size={4}>
            {nft.isListed ? (
              <Text strong style={{ color: '#52c41a' }}>
                {formatDust(nft.listPrice || 0n)} DUST
              </Text>
            ) : (
              <Text type="secondary">未上架</Text>
            )}
            <Text type="secondary" style={{ fontSize: '12px' }}>
              转让次数: {nft.transferCount}
            </Text>
          </Space>
        }
      />
      <div className="nft-actions">
        {nft.isListed ? (
          <Button size="small" onClick={() => handleCancelListing(nft)}>
            下架
          </Button>
        ) : (
          <Button
            type="primary"
            size="small"
            icon={<ShopOutlined />}
            onClick={() => openListModal(nft)}
          >
            上架
          </Button>
        )}
        <Button
          size="small"
          icon={<SendOutlined />}
          onClick={() => openTransferModal(nft)}
          disabled={nft.isListed}
        >
          转移
        </Button>
      </div>
    </Card>
  );

  /** 渲染可铸造的卦象 */
  const renderHexagramCard = (hexagram: Hexagram) => (
    <Card
      className="hexagram-mint-card"
      hoverable
      onClick={() => openMintModal(hexagram)}
    >
      <div className="hexagram-brief">
        <span className="trigram-symbol">
          {TRIGRAM_SYMBOLS[hexagram.upperTrigram as Trigram]}
          {TRIGRAM_SYMBOLS[hexagram.lowerTrigram as Trigram]}
        </span>
        <div className="hexagram-info">
          <Text strong>卦象 #{hexagram.id}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {new Date(hexagram.divinationTime).toLocaleDateString()}
          </Text>
        </div>
      </div>
      <Button type="link" icon={<GiftOutlined />}>
        铸造 NFT
      </Button>
    </Card>
  );

  if (!address) {
    return (
      <div className="my-nft-page">
        <Empty description="请先连接钱包" />
      </div>
    );
  }

  return (
    <div className="my-nft-page">
      <div className="page-header">
        <Title level={4}>我的 NFT</Title>
        <Text type="secondary">管理您的卦象 NFT 收藏</Text>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'owned',
            label: `我的 NFT (${myNfts.length})`,
            children: loading ? (
              <div className="loading-container">
                <Spin size="large" tip="加载中..." />
              </div>
            ) : myNfts.length === 0 ? (
              <Empty description="暂无 NFT" />
            ) : (
              <List
                grid={{ gutter: 16, xs: 1, sm: 2, md: 2 }}
                dataSource={myNfts}
                renderItem={renderNftCard}
              />
            ),
          },
          {
            key: 'mint',
            label: '铸造 NFT',
            children: myHexagrams.length === 0 ? (
              <Empty
                description="暂无可铸造的卦象"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button type="primary" href="#/meihua">
                  去起卦
                </Button>
              </Empty>
            ) : (
              <div className="hexagram-list">
                {myHexagrams.map((hex) => (
                  <div key={hex.id}>{renderHexagramCard(hex)}</div>
                ))}
              </div>
            ),
          },
        ]}
      />

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
        confirmLoading={listing}
      >
        {selectedNft && (
          <div className="list-form">
            <div className="nft-preview">
              <Text strong>{selectedNft.name}</Text>
              <Tag color={NFT_RARITY_COLORS[selectedNft.rarity]}>
                {NFT_RARITY_NAMES[selectedNft.rarity]}
              </Tag>
            </div>
            <div className="price-input">
              <Text>设置价格（DUST）：</Text>
              <Input
                type="number"
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
                placeholder="输入价格"
                suffix="DUST"
                style={{ marginTop: 8 }}
              />
            </div>
          </div>
        )}
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
        confirmLoading={transferring}
      >
        {selectedNft && (
          <div className="transfer-form">
            <div className="nft-preview">
              <Text strong>{selectedNft.name}</Text>
              <Tag color={NFT_RARITY_COLORS[selectedNft.rarity]}>
                {NFT_RARITY_NAMES[selectedNft.rarity]}
              </Tag>
            </div>
            <div className="address-input">
              <Text>接收地址：</Text>
              <Input
                value={transferTo}
                onChange={(e) => setTransferTo(e.target.value)}
                placeholder="输入接收者地址"
                style={{ marginTop: 8 }}
              />
            </div>
            <Text type="warning" style={{ marginTop: 12, display: 'block' }}>
              注意：转移后无法撤回，请确认地址正确
            </Text>
          </div>
        )}
      </Modal>

      {/* 铸造弹窗 */}
      <Modal
        title="铸造卦象 NFT"
        open={mintModalVisible}
        onCancel={() => {
          setMintModalVisible(false);
          mintForm.resetFields();
          setSelectedHexagram(null);
        }}
        footer={null}
        width={480}
      >
        {selectedHexagram && (
          <Form
            form={mintForm}
            layout="vertical"
            onFinish={handleMint}
            initialValues={{ royaltyRate: 5 }}
          >
            <div className="hexagram-preview">
              <span className="preview-symbol">
                {TRIGRAM_SYMBOLS[selectedHexagram.upperTrigram as Trigram]}
                {TRIGRAM_SYMBOLS[selectedHexagram.lowerTrigram as Trigram]}
              </span>
              <Text>卦象 #{selectedHexagram.id}</Text>
            </div>

            <Form.Item
              name="name"
              label="NFT 名称"
              rules={[{ required: true, message: '请输入名称' }]}
            >
              <Input placeholder="为您的 NFT 起个名字" maxLength={50} />
            </Form.Item>

            <Form.Item
              name="metadataCid"
              label="元数据 CID（可选）"
              tooltip="IPFS 上的元数据哈希"
            >
              <Input placeholder="Qm..." />
            </Form.Item>

            <Form.Item
              name="royaltyRate"
              label="版税比例"
              tooltip="每次转售时您将获得的版税"
              rules={[
                { required: true, message: '请输入版税比例' },
                { type: 'number', min: 0, max: 25, message: '版税范围 0-25%' },
              ]}
            >
              <InputNumber
                min={0}
                max={25}
                step={0.5}
                addonAfter="%"
                style={{ width: '100%' }}
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={minting}
                block
                icon={<PlusOutlined />}
              >
                铸造 NFT
              </Button>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default MyNftPage;
