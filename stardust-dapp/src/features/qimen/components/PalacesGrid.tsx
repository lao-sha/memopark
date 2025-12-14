/**
 * 奇门遁甲九宫格展示组件
 *
 * 功能：
 * - 以九宫格形式展示所有宫位
 * - 显示每宫的星门神和吉凶
 * - 点击宫位查看详细信息
 * - 高亮显示特殊宫位（用神宫、值符宫等）
 */

import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Tag,
  Modal,
  Space,
  Typography,
  Descriptions,
  Badge,
} from 'antd';
import {
  StarOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { PalaceInterpretation } from '../../../types/qimen';
import {
  JIU_GONG_NAMES,
  JIU_XING_NAMES,
  BA_MEN_NAMES,
  BA_SHEN_NAMES,
  QI_YI_NAMES,
  WU_XING_NAMES,
  FORTUNE_NAMES,
  FORTUNE_COLORS,
  WANG_SHUAI_STATUS_NAMES,
  XING_MEN_RELATION_NAMES,
} from '../../../types/qimen';

const { Text } = Typography;

interface Props {
  palaces: PalaceInterpretation[];
  highlightGongs?: number[]; // 需要高亮的宫位（如用神宫）
  onPalaceClick?: (palace: PalaceInterpretation) => void;
}

export const PalacesGrid: React.FC<Props> = ({
  palaces,
  highlightGongs = [],
  onPalaceClick,
}) => {
  const [selectedPalace, setSelectedPalace] =
    useState<PalaceInterpretation | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  /**
   * 获取宫位索引（九宫格布局）
   * 九宫格排列：
   * 4 9 2
   * 3 5 7
   * 8 1 6
   */
  const getGridPosition = (gong: string): number => {
    const positions: Record<string, number> = {
      Xun: 0, // 巽 - 左上
      Li: 1,  // 离 - 中上
      Kun: 2, // 坤 - 右上
      Zhen: 3, // 震 - 左中
      Zhong: 4, // 中 - 中中
      Dui: 5, // 兑 - 右中
      Gen: 6, // 艮 - 左下
      Kan: 7, // 坎 - 中下
      Qian: 8, // 乾 - 右下
    };
    return positions[gong] ?? 4;
  };

  /**
   * 按九宫格位置排序宫位
   */
  const sortedPalaces = [...palaces].sort((a, b) => {
    return getGridPosition(a.gong) - getGridPosition(b.gong);
  });

  /**
   * 处理宫位点击
   */
  const handlePalaceClick = (palace: PalaceInterpretation) => {
    setSelectedPalace(palace);
    setModalVisible(true);
    onPalaceClick?.(palace);
  };

  /**
   * 渲染单个宫位卡片
   */
  const renderPalaceCard = (palace: PalaceInterpretation) => {
    const isHighlight = highlightGongs.includes(
      Object.keys(JIU_GONG_NAMES).indexOf(palace.gong) + 1
    );

    return (
      <Card
        key={palace.gong}
        size="small"
        hoverable
        onClick={() => handlePalaceClick(palace)}
        style={{
          height: '100%',
          borderColor: isHighlight ? '#1890ff' : undefined,
          borderWidth: isHighlight ? 2 : 1,
          backgroundColor: isHighlight ? '#e6f7ff' : undefined,
        }}
        bodyStyle={{ padding: 8 }}
      >
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          {/* 宫位名称 */}
          <div style={{ textAlign: 'center' }}>
            <Badge
              count={isHighlight ? '用神' : 0}
              style={{ backgroundColor: '#52c41a' }}
            >
              <Tag color="purple" style={{ margin: 0 }}>
                {JIU_GONG_NAMES[palace.gong]}
              </Tag>
            </Badge>
          </div>

          {/* 九星 */}
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>星：</Text>
            <Tag color="blue" style={{ fontSize: 12, margin: '0 0 0 4px' }}>
              {JIU_XING_NAMES[palace.xing]}
            </Tag>
          </div>

          {/* 八门 */}
          {palace.men && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>门：</Text>
              <Tag color="green" style={{ fontSize: 12, margin: '0 0 0 4px' }}>
                {BA_MEN_NAMES[palace.men]}
              </Tag>
            </div>
          )}

          {/* 八神 */}
          {palace.shen && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>神：</Text>
              <Tag color="orange" style={{ fontSize: 12, margin: '0 0 0 4px' }}>
                {BA_SHEN_NAMES[palace.shen]}
              </Tag>
            </div>
          )}

          {/* 吉凶 */}
          <div style={{ textAlign: 'center' }}>
            <Tag
              color={FORTUNE_COLORS[palace.fortune]}
              style={{ fontSize: 12, margin: 0 }}
            >
              {FORTUNE_NAMES[palace.fortune]} {palace.fortuneScore}
            </Tag>
          </div>

          {/* 特殊状态标记 */}
          <div style={{ textAlign: 'center' }}>
            {palace.isFuYin && (
              <Tag color="warning" style={{ fontSize: 10, margin: '2px' }}>伏吟</Tag>
            )}
            {palace.isFanYin && (
              <Tag color="error" style={{ fontSize: 10, margin: '2px' }}>反吟</Tag>
            )}
            {palace.isXunKong && (
              <Tag color="default" style={{ fontSize: 10, margin: '2px' }}>旬空</Tag>
            )}
            {palace.isMaXing && (
              <Tag color="success" style={{ fontSize: 10, margin: '2px' }}>马星</Tag>
            )}
          </div>
        </Space>
      </Card>
    );
  };

  return (
    <>
      <Card
        title={
          <Space>
            <StarOutlined />
            九宫详解
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <Row gutter={[8, 8]}>
            {sortedPalaces.map((palace) => (
              <Col xs={8} key={palace.gong}>
                {renderPalaceCard(palace)}
              </Col>
            ))}
          </Row>
        </div>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Text type="secondary">
            <InfoCircleOutlined /> 点击宫位查看详细信息
          </Text>
        </div>
      </Card>

      {/* 宫位详情弹窗 */}
      <Modal
        title={
          <Space>
            <StarOutlined />
            {selectedPalace && JIU_GONG_NAMES[selectedPalace.gong]}宫详解
          </Space>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        {selectedPalace && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="宫位">
              {JIU_GONG_NAMES[selectedPalace.gong]}
            </Descriptions.Item>
            <Descriptions.Item label="天盘干">
              <Tag color="blue">{QI_YI_NAMES[selectedPalace.tianPanGan]}</Tag>
              <Text type="secondary">
                （{WU_XING_NAMES[selectedPalace.tianWuxing]}）
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="地盘干">
              <Tag color="cyan">{QI_YI_NAMES[selectedPalace.diPanGan]}</Tag>
              <Text type="secondary">
                （{WU_XING_NAMES[selectedPalace.diWuxing]}）
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="九星">
              <Tag color="blue">{JIU_XING_NAMES[selectedPalace.xing]}</Tag>
            </Descriptions.Item>
            {selectedPalace.men && (
              <Descriptions.Item label="八门">
                <Tag color="green">{BA_MEN_NAMES[selectedPalace.men]}</Tag>
              </Descriptions.Item>
            )}
            {selectedPalace.shen && (
              <Descriptions.Item label="八神">
                <Tag color="orange">{BA_SHEN_NAMES[selectedPalace.shen]}</Tag>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="宫位五行">
              <Tag>{WU_XING_NAMES[selectedPalace.gongWuxing]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="星门关系">
              <Tag color="purple">
                {XING_MEN_RELATION_NAMES[selectedPalace.xingMenRelation]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="旺衰状态">
              <Tag color="orange">
                {WANG_SHUAI_STATUS_NAMES[selectedPalace.wangShuai]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="吉凶">
              <Tag color={FORTUNE_COLORS[selectedPalace.fortune]}>
                {FORTUNE_NAMES[selectedPalace.fortune]} ({selectedPalace.fortuneScore} 分)
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="特殊状态">
              <Space>
                {selectedPalace.isFuYin && (
                  <Tag color="warning">
                    <WarningOutlined /> 伏吟
                  </Tag>
                )}
                {selectedPalace.isFanYin && (
                  <Tag color="error">
                    <WarningOutlined /> 反吟
                  </Tag>
                )}
                {selectedPalace.isXunKong && (
                  <Tag color="default">旬空</Tag>
                )}
                {selectedPalace.isMaXing && (
                  <Tag color="success">
                    <ThunderboltOutlined /> 马星
                  </Tag>
                )}
                {!selectedPalace.isFuYin &&
                  !selectedPalace.isFanYin &&
                  !selectedPalace.isXunKong &&
                  !selectedPalace.isMaXing && (
                    <Text type="secondary">无</Text>
                  )}
              </Space>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </>
  );
};
