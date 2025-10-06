import React, { useState, useEffect } from 'react';
import { Button, Typography, Space, message, Alert } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

/**
 * 函数级详细中文注释：验证助记词页面组件
 * - 在用户查看助记词后，要求验证部分助记词
 * - 随机抽取 3-4 个位置，让用户从选项中选择正确的单词
 * - 验证通过后才能完成钱包创建
 * - 确保用户真正备份了助记词
 * - 移动端优先设计，最大宽度 640px 居中
 */
interface VerifyMnemonicPageProps {
  mnemonic: string;
  onVerifySuccess: () => void;
  onBack?: () => void;
}

interface VerificationItem {
  position: number;      // 位置（1-12）
  correctWord: string;   // 正确的单词
  options: string[];     // 选项（包含正确答案）
  selected?: string;     // 用户选择的单词
}

const VerifyMnemonicPage: React.FC<VerifyMnemonicPageProps> = ({
  mnemonic,
  onVerifySuccess,
  onBack
}) => {
  const [verificationItems, setVerificationItems] = useState<VerificationItem[]>([]);
  const [showError, setShowError] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  /**
   * 函数级详细中文注释：初始化验证项
   * - 将助记词分割成单词数组
   * - 随机选择 3 个位置进行验证
   * - 为每个位置生成 3 个干扰选项
   * - 打乱选项顺序
   */
  useEffect(() => {
    const words = mnemonic.trim().split(/\s+/);
    
    // 随机选择 3 个位置进行验证
    const positions: number[] = [];
    while (positions.length < 3) {
      const randomPos = Math.floor(Math.random() * words.length);
      if (!positions.includes(randomPos)) {
        positions.push(randomPos);
      }
    }
    positions.sort((a, b) => a - b);

    // 为每个位置生成验证项
    const items: VerificationItem[] = positions.map(pos => {
      const correctWord = words[pos];
      
      // 生成干扰选项（从其他位置随机选择）
      const distractors: string[] = [];
      while (distractors.length < 3) {
        const randomPos = Math.floor(Math.random() * words.length);
        const word = words[randomPos];
        if (word !== correctWord && !distractors.includes(word)) {
          distractors.push(word);
        }
      }
      
      // 合并正确答案和干扰项，并打乱顺序
      const options = [correctWord, ...distractors].sort(() => Math.random() - 0.5);
      
      return {
        position: pos + 1,
        correctWord,
        options,
      };
    });

    setVerificationItems(items);
  }, [mnemonic]);

  /**
   * 函数级详细中文注释：处理选项选择
   * - 更新用户选择的单词
   * - 清除错误提示
   */
  const handleSelectWord = (index: number, word: string) => {
    const newItems = [...verificationItems];
    newItems[index].selected = word;
    setVerificationItems(newItems);
    setShowError(false);
  };

  /**
   * 函数级详细中文注释：验证答案
   * - 检查是否所有位置都已选择
   * - 验证每个位置的答案是否正确
   * - 全部正确则调用成功回调
   * - 有错误则显示错误提示
   */
  const handleVerify = () => {
    // 检查是否所有位置都已选择
    const allSelected = verificationItems.every(item => item.selected);
    if (!allSelected) {
      message.warning('请选择所有位置的助记词');
      return;
    }

    setIsVerifying(true);

    // 验证答案
    const allCorrect = verificationItems.every(
      item => item.selected === item.correctWord
    );

    setTimeout(() => {
      setIsVerifying(false);
      
      if (allCorrect) {
        message.success('验证成功！');
        setTimeout(() => {
          onVerifySuccess();
        }, 500);
      } else {
        setShowError(true);
        message.error('验证失败，请重新选择');
      }
    }, 800);
  };

  return (
    <div
      style={{
        padding: '20px',
        maxWidth: '640px',
        margin: '0 auto',
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #f0f5ff 0%, #ffffff 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      {/* 返回按钮 */}
      {onBack && (
        <div style={{ position: 'absolute', top: '20px', left: '20px' }}>
          <Button type="text" onClick={onBack}>
            &lt; 验证助记词
          </Button>
        </div>
      )}

      {/* 标题区域 */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 8px 24px rgba(24, 144, 255, 0.3)',
          }}
        >
          <CheckCircleOutlined style={{ fontSize: '40px', color: '#fff' }} />
        </div>
        <Title level={2} style={{ color: '#1890ff', marginBottom: '8px' }}>
          验证助记词
        </Title>
        <Text type="secondary" style={{ fontSize: '14px' }}>
          请按顺序选择正确的助记词，以确保您已正确备份
        </Text>
      </div>

      {/* 错误提示 */}
      {showError && (
        <Alert
          type="error"
          showIcon
          message="验证失败"
          description="您选择的助记词不正确，请仔细回忆并重新选择"
          style={{ marginBottom: '24px' }}
          closable
          onClose={() => setShowError(false)}
        />
      )}

      {/* 验证项列表 */}
      <div style={{ marginBottom: '32px' }}>
        <Space direction="vertical" style={{ width: '100%' }} size={24}>
          {verificationItems.map((item, index) => (
            <div
              key={index}
              style={{
                background: '#fff',
                padding: '20px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
              }}
            >
              {/* 问题标题 */}
              <div style={{ marginBottom: '16px' }}>
                <Text strong style={{ fontSize: '16px' }}>
                  第 {item.position} 个助记词是？
                </Text>
              </div>

              {/* 选项网格 */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px',
                }}
              >
                {item.options.map((option, optIndex) => {
                  const isSelected = item.selected === option;
                  const isCorrect = item.correctWord === option;
                  const showResult = showError && isSelected;
                  
                  return (
                    <button
                      key={optIndex}
                      onClick={() => handleSelectWord(index, option)}
                      style={{
                        padding: '16px',
                        borderRadius: '8px',
                        border: isSelected
                          ? showResult && !isCorrect
                            ? '2px solid #ff4d4f'
                            : '2px solid #1890ff'
                          : '2px solid #e8e8e8',
                        background: isSelected
                          ? showResult && !isCorrect
                            ? '#fff2f0'
                            : '#e6f7ff'
                          : '#fafafa',
                        cursor: 'pointer',
                        fontSize: '16px',
                        fontWeight: isSelected ? 'bold' : 'normal',
                        color: isSelected
                          ? showResult && !isCorrect
                            ? '#ff4d4f'
                            : '#1890ff'
                          : '#262626',
                        transition: 'all 0.3s',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      disabled={isVerifying}
                    >
                      {option}
                      {showResult && isSelected && !isCorrect && (
                        <CloseCircleOutlined
                          style={{
                            position: 'absolute',
                            right: '8px',
                            color: '#ff4d4f',
                            fontSize: '16px',
                          }}
                        />
                      )}
                      {isSelected && !showError && (
                        <CheckCircleOutlined
                          style={{
                            position: 'absolute',
                            right: '8px',
                            color: '#1890ff',
                            fontSize: '16px',
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </Space>
      </div>

      {/* 提示信息 */}
      <div
        style={{
          background: '#e6f7ff',
          border: '1px solid #91d5ff',
          padding: '16px',
          borderRadius: '12px',
          marginBottom: '24px',
        }}
      >
        <Text style={{ fontSize: '12px', color: '#595959' }}>
          💡 提示：如果忘记了助记词，可以返回上一步重新查看
        </Text>
      </div>

      {/* 验证按钮 */}
      <Button
        type="primary"
        size="large"
        block
        onClick={handleVerify}
        loading={isVerifying}
        disabled={!verificationItems.every(item => item.selected)}
        style={{
          height: '56px',
          fontSize: '16px',
          fontWeight: 'bold',
          borderRadius: '12px',
          background:
            verificationItems.every(item => item.selected) && !isVerifying
              ? 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)'
              : undefined,
          border: 'none',
          boxShadow:
            verificationItems.every(item => item.selected) && !isVerifying
              ? '0 4px 12px rgba(24, 144, 255, 0.3)'
              : undefined,
        }}
      >
        {isVerifying ? '验证中...' : '完成验证'}
      </Button>

      {/* 底部提示 */}
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          验证通过后，您的钱包将被保存到本地
        </Text>
      </div>
    </div>
  );
};

export default VerifyMnemonicPage;

