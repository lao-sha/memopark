/**
 * 函数级详细中文注释：Emoji表情选择器组件
 * - 常用表情快速选择
 * - 点击插入到输入框
 * - 移动端优化设计
 */

import React from 'react';
import { Popover, Button } from 'antd';
import { SmileOutlined } from '@ant-design/icons';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

/**
 * 常用表情列表
 */
const EMOJI_LIST = [
  // 笑脸类
  '😀', '😃', '😄', '😁', '😅', '😂', '🤣',
  '😊', '😇', '🙂', '🙃', '😉', '😌', '😍',
  '🥰', '😘', '😗', '😙', '😚', '😋', '😛',
  '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎',
  
  // 情绪类
  '🥳', '🤗', '🤔', '🤐', '😐', '😑', '😶',
  '😏', '😒', '🙄', '😬', '🤥', '😌', '😔',
  '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢',
  
  // 手势类
  '👍', '👎', '👌', '🤝', '💪', '🙏', '👏',
  '🤲', '🙌', '👐', '🤲', '✋', '🤚', '👋',
  
  // 爱心类
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤',
  '💔', '❤️‍🔥', '❤️‍🩹', '💕', '💖', '💗', '💘',
  '💝', '💞', '💓', '💟', '💌',
  
  // 庆祝类
  '🎉', '🎊', '🎈', '🎁', '🎀', '🎂', '🍰',
  
  // 花类（纪念主题）
  '🌹', '🌸', '🌺', '🌻', '🌼', '🌷', '🏵️',
  '💐', '🥀',
  
  // 蜡烛类（纪念主题）
  '🕯️', '🪔',
  
  // 其他
  '⭐', '✨', '🌟', '💫', '🔥', '💯',
];

/**
 * Emoji分类
 */
const EMOJI_CATEGORIES = [
  { name: '笑脸', emojis: EMOJI_LIST.slice(0, 28) },
  { name: '情绪', emojis: EMOJI_LIST.slice(28, 49) },
  { name: '手势', emojis: EMOJI_LIST.slice(49, 63) },
  { name: '爱心', emojis: EMOJI_LIST.slice(63, 82) },
  { name: '庆祝', emojis: EMOJI_LIST.slice(82, 89) },
  { name: '纪念', emojis: EMOJI_LIST.slice(89, 100) },
  { name: '其他', emojis: EMOJI_LIST.slice(100) },
];

/**
 * Emoji选择器组件
 */
export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect }) => {
  const [activeCategory, setActiveCategory] = React.useState(0);
  
  const emojiContent = (
    <div style={{ width: 320, maxHeight: 400 }}>
      {/* 分类标签 */}
      <div style={{
        display: 'flex',
        gap: 4,
        padding: '8px 8px 4px',
        borderBottom: '2px solid rgba(184, 134, 11, 0.2)',
        overflowX: 'auto',
      }}>
        {EMOJI_CATEGORIES.map((category, index) => (
          <Button
            key={index}
            type={activeCategory === index ? 'primary' : 'text'}
            size="small"
            onClick={() => setActiveCategory(index)}
            style={{
              background: activeCategory === index 
                ? 'linear-gradient(135deg, #B8860B 0%, #D4AF37 100%)'
                : 'transparent',
              border: 'none',
              fontSize: 12,
              padding: '4px 12px',
              height: 28,
            }}
          >
            {category.name}
          </Button>
        ))}
      </div>
      
      {/* Emoji网格 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 4,
        padding: 8,
        maxHeight: 300,
        overflowY: 'auto',
      }}>
        {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji, index) => (
          <Button
            key={index}
            type="text"
            onClick={() => onSelect(emoji)}
            style={{
              fontSize: 24,
              padding: 4,
              height: 40,
              width: 40,
              border: '1px solid transparent',
              borderRadius: 8,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(184, 134, 11, 0.3)';
              e.currentTarget.style.background = 'rgba(184, 134, 11, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {emoji}
          </Button>
        ))}
      </div>
    </div>
  );
  
  return (
    <Popover 
      content={emojiContent} 
      trigger="click" 
      placement="topLeft"
      overlayStyle={{ zIndex: 1000 }}
    >
      <Button
        type="text"
        icon={<SmileOutlined style={{ fontSize: 20, color: '#B8860B' }} />}
        style={{
          padding: '4px 8px',
          height: 38,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />
    </Popover>
  );
};

