"""
Transformer时序预测模型
使用自注意力机制捕捉长期依赖关系
"""

import torch
import torch.nn as nn
import math
import numpy as np
from typing import Tuple, List, Dict, Optional
from pathlib import Path


class PositionalEncoding(nn.Module):
    """位置编码"""
    
    def __init__(self, d_model: int, max_len: int = 5000):
        super(PositionalEncoding, self).__init__()
        
        # 创建位置编码矩阵
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
        
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        
        pe = pe.unsqueeze(0).transpose(0, 1)
        self.register_buffer('pe', pe)
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x + self.pe[:x.size(0), :]


class TransformerPricePredictor(nn.Module):
    """
    Transformer价格预测器
    
    架构:
    - Input Embedding + Positional Encoding
    - Transformer Encoder (4 layers, 8 heads)
    - Output Layer: 3个类别（BUY/HOLD/SELL）
    """
    
    def __init__(
        self,
        num_features: int = 13,
        d_model: int = 128,
        nhead: int = 8,
        num_layers: int = 4,
        dim_feedforward: int = 512,
        dropout: float = 0.1,
        num_classes: int = 3
    ):
        """
        初始化Transformer模型
        
        Args:
            num_features: 输入特征数量
            d_model: 模型维度（必须能被nhead整除）
            nhead: 注意力头数
            num_layers: Transformer层数
            dim_feedforward: 前馈网络维度
            dropout: Dropout比率
            num_classes: 输出类别数
        """
        super(TransformerPricePredictor, self).__init__()
        
        self.num_features = num_features
        self.d_model = d_model
        self.nhead = nhead
        self.num_layers = num_layers
        self.num_classes = num_classes
        
        # 输入投影层（将特征映射到d_model维度）
        self.input_projection = nn.Linear(num_features, d_model)
        
        # 位置编码
        self.pos_encoder = PositionalEncoding(d_model)
        
        # Transformer编码器
        encoder_layers = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=nhead,
            dim_feedforward=dim_feedforward,
            dropout=dropout,
            batch_first=True
        )
        self.transformer_encoder = nn.TransformerEncoder(
            encoder_layers,
            num_layers=num_layers
        )
        
        # 输出层
        self.fc1 = nn.Linear(d_model, 64)
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(dropout)
        self.fc2 = nn.Linear(64, num_classes)
        self.softmax = nn.Softmax(dim=1)
    
    def forward(self, x: torch.Tensor, mask: Optional[torch.Tensor] = None) -> torch.Tensor:
        """
        前向传播
        
        Args:
            x: 输入张量 (batch_size, sequence_length, num_features)
            mask: 注意力掩码（可选）
            
        Returns:
            输出张量 (batch_size, num_classes)
        """
        # 输入投影
        x = self.input_projection(x) * math.sqrt(self.d_model)
        
        # 位置编码
        x = x.transpose(0, 1)  # (seq_len, batch_size, d_model)
        x = self.pos_encoder(x)
        x = x.transpose(0, 1)  # (batch_size, seq_len, d_model)
        
        # Transformer编码
        transformer_out = self.transformer_encoder(x, src_key_padding_mask=mask)
        
        # 取最后一个时间步
        last_output = transformer_out[:, -1, :]
        
        # 输出层
        out = self.fc1(last_output)
        out = self.relu(out)
        out = self.dropout(out)
        out = self.fc2(out)
        
        # Softmax
        probabilities = self.softmax(out)
        
        return probabilities


class TransformerModelManager:
    """
    Transformer模型管理器
    """
    
    def __init__(self, model_path: str = "models/transformer_model.pth"):
        """初始化模型管理器"""
        self.model_path = Path(model_path)
        self.model: Optional[TransformerPricePredictor] = None
        self.scaler = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # 加载模型（如果存在）
        if self.model_path.exists():
            self.load_model()
        else:
            # 创建新模型
            self.model = TransformerPricePredictor()
            self.model.to(self.device)
    
    def load_model(self):
        """加载已训练的模型"""
        try:
            checkpoint = torch.load(self.model_path, map_location=self.device)
            
            self.model = TransformerPricePredictor(
                num_features=checkpoint.get('num_features', 13),
                d_model=checkpoint.get('d_model', 128),
                nhead=checkpoint.get('nhead', 8),
                num_layers=checkpoint.get('num_layers', 4),
                dim_feedforward=checkpoint.get('dim_feedforward', 512),
                dropout=checkpoint.get('dropout', 0.1)
            )
            
            self.model.load_state_dict(checkpoint['model_state_dict'])
            self.model.to(self.device)
            self.model.eval()
            
            if 'scaler' in checkpoint:
                self.scaler = checkpoint['scaler']
            
            print(f"✅ Transformer模型已从 {self.model_path} 加载")
            
        except Exception as e:
            print(f"❌ 加载模型失败: {e}")
            self.model = TransformerPricePredictor()
            self.model.to(self.device)
    
    def save_model(self, metrics: Dict = None):
        """保存模型"""
        self.model_path.parent.mkdir(parents=True, exist_ok=True)
        
        checkpoint = {
            'model_state_dict': self.model.state_dict(),
            'num_features': self.model.num_features,
            'd_model': self.model.d_model,
            'nhead': self.model.nhead,
            'num_layers': self.model.num_layers,
            'dim_feedforward': 512,
            'dropout': 0.1,
            'scaler': self.scaler,
            'metrics': metrics or {}
        }
        
        torch.save(checkpoint, self.model_path)
        print(f"✅ 模型已保存到 {self.model_path}")
    
    def prepare_sequence(
        self,
        features_list: List[np.ndarray],
        sequence_length: int = 24
    ) -> torch.Tensor:
        """
        准备Transformer输入序列
        
        Args:
            features_list: 特征列表
            sequence_length: 序列长度（默认24，对应2小时）
            
        Returns:
            torch张量
        """
        if len(features_list) < sequence_length:
            padding = [features_list[0]] * (sequence_length - len(features_list))
            features_list = padding + features_list
        
        sequence = np.array(features_list[-sequence_length:])
        
        if self.scaler is not None:
            sequence = self.scaler.transform(sequence)
        
        tensor = torch.FloatTensor(sequence).unsqueeze(0)
        return tensor.to(self.device)
    
    def predict(
        self,
        features_sequence: List[np.ndarray]
    ) -> Tuple[str, int, Dict[str, float]]:
        """
        预测交易信号
        
        Returns:
            (signal, confidence, probabilities)
        """
        if self.model is None:
            raise RuntimeError("模型未初始化")
        
        x = self.prepare_sequence(features_sequence)
        
        self.model.eval()
        with torch.no_grad():
            probabilities = self.model(x)
            
            probs = probabilities.cpu().numpy()[0]
            prob_dict = {
                "buy_prob": float(probs[0]),
                "hold_prob": float(probs[1]),
                "sell_prob": float(probs[2])
            }
            
            max_prob_idx = np.argmax(probs)
            signal_map = {0: "BUY", 1: "HOLD", 2: "SELL"}
            signal = signal_map[max_prob_idx]
            confidence = int(probs[max_prob_idx] * 100)
            
            return signal, confidence, prob_dict
    
    def train_model(
        self,
        train_loader,
        val_loader,
        num_epochs: int = 50,
        learning_rate: float = 0.0001
    ):
        """训练模型"""
        criterion = nn.CrossEntropyLoss()
        optimizer = torch.optim.Adam(self.model.parameters(), lr=learning_rate)
        scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
            optimizer, mode='min', patience=5, factor=0.5
        )
        
        best_val_loss = float('inf')
        
        for epoch in range(num_epochs):
            # 训练阶段
            self.model.train()
            train_loss = 0.0
            
            for batch_x, batch_y in train_loader:
                batch_x = batch_x.to(self.device)
                batch_y = batch_y.to(self.device)
                
                outputs = self.model(batch_x)
                loss = criterion(outputs, batch_y)
                
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()
                
                train_loss += loss.item()
            
            # 验证阶段
            self.model.eval()
            val_loss = 0.0
            correct = 0
            total = 0
            
            with torch.no_grad():
                for batch_x, batch_y in val_loader:
                    batch_x = batch_x.to(self.device)
                    batch_y = batch_y.to(self.device)
                    
                    outputs = self.model(batch_x)
                    loss = criterion(outputs, batch_y)
                    val_loss += loss.item()
                    
                    _, predicted = torch.max(outputs.data, 1)
                    total += batch_y.size(0)
                    correct += (predicted == batch_y).sum().item()
            
            avg_train_loss = train_loss / len(train_loader)
            avg_val_loss = val_loss / len(val_loader)
            accuracy = 100 * correct / total
            
            print(f"Epoch [{epoch+1}/{num_epochs}] "
                  f"Train Loss: {avg_train_loss:.4f} | "
                  f"Val Loss: {avg_val_loss:.4f} | "
                  f"Accuracy: {accuracy:.2f}%")
            
            scheduler.step(avg_val_loss)
            
            if avg_val_loss < best_val_loss:
                best_val_loss = avg_val_loss
                self.save_model({
                    'epoch': epoch + 1,
                    'train_loss': avg_train_loss,
                    'val_loss': avg_val_loss,
                    'accuracy': accuracy
                })
                print("✅ 最佳模型已保存")

