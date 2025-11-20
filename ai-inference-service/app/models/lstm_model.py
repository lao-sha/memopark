"""
LSTM时序预测模型
用于预测未来价格走势和生成交易信号
"""

import torch
import torch.nn as nn
import numpy as np
from typing import Tuple, List, Dict, Optional
import pickle
from pathlib import Path


class LSTMPricePredictor(nn.Module):
    """
    LSTM价格预测器
    
    架构:
    - Input Layer: (batch_size, sequence_length, num_features)
    - LSTM Layers: 2层LSTM，hidden_size=128
    - Dropout: 0.2
    - Output Layer: 3个输出（BUY/HOLD/SELL概率）
    """
    
    def __init__(
        self,
        num_features: int = 13,
        hidden_size: int = 128,
        num_layers: int = 2,
        dropout: float = 0.2,
        num_classes: int = 3
    ):
        """
        初始化LSTM模型
        
        Args:
            num_features: 输入特征数量（默认13）
            hidden_size: LSTM隐藏层大小
            num_layers: LSTM层数
            dropout: Dropout比率
            num_classes: 输出类别数（3: BUY/HOLD/SELL）
        """
        super(LSTMPricePredictor, self).__init__()
        
        self.num_features = num_features
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.num_classes = num_classes
        
        # LSTM层
        self.lstm = nn.LSTM(
            input_size=num_features,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0
        )
        
        # Dropout层
        self.dropout = nn.Dropout(dropout)
        
        # 全连接层
        self.fc1 = nn.Linear(hidden_size, 64)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(64, num_classes)
        self.softmax = nn.Softmax(dim=1)
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        前向传播
        
        Args:
            x: 输入张量 (batch_size, sequence_length, num_features)
            
        Returns:
            输出张量 (batch_size, num_classes)
        """
        # LSTM层
        lstm_out, (h_n, c_n) = self.lstm(x)
        
        # 取最后一个时间步的输出
        last_output = lstm_out[:, -1, :]
        
        # Dropout
        out = self.dropout(last_output)
        
        # 全连接层
        out = self.fc1(out)
        out = self.relu(out)
        out = self.fc2(out)
        
        # Softmax（获取概率）
        probabilities = self.softmax(out)
        
        return probabilities
    
    def predict(self, x: torch.Tensor) -> Tuple[str, float]:
        """
        预测交易信号
        
        Args:
            x: 输入张量
            
        Returns:
            (signal, confidence): 交易信号和置信度
        """
        self.eval()
        with torch.no_grad():
            probabilities = self.forward(x)
            
            # 获取最大概率的类别
            max_prob, predicted_class = torch.max(probabilities, dim=1)
            
            # 映射到交易信号
            signal_map = {0: "BUY", 1: "HOLD", 2: "SELL"}
            signal = signal_map[predicted_class.item()]
            confidence = int(max_prob.item() * 100)
            
            return signal, confidence


class LSTMModelManager:
    """
    LSTM模型管理器
    负责模型加载、保存和推理
    """
    
    def __init__(self, model_path: str = "models/lstm_model.pth"):
        """
        初始化模型管理器
        
        Args:
            model_path: 模型文件路径
        """
        self.model_path = Path(model_path)
        self.model: Optional[LSTMPricePredictor] = None
        self.scaler = None  # 特征缩放器
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # 加载模型（如果存在）
        if self.model_path.exists():
            self.load_model()
        else:
            # 创建新模型
            self.model = LSTMPricePredictor()
            self.model.to(self.device)
    
    def load_model(self):
        """加载已训练的模型"""
        try:
            checkpoint = torch.load(self.model_path, map_location=self.device)
            
            self.model = LSTMPricePredictor(
                num_features=checkpoint.get('num_features', 13),
                hidden_size=checkpoint.get('hidden_size', 128),
                num_layers=checkpoint.get('num_layers', 2),
                dropout=checkpoint.get('dropout', 0.2)
            )
            
            self.model.load_state_dict(checkpoint['model_state_dict'])
            self.model.to(self.device)
            self.model.eval()
            
            # 加载缩放器
            if 'scaler' in checkpoint:
                self.scaler = checkpoint['scaler']
            
            print(f"✅ LSTM模型已从 {self.model_path} 加载")
            
        except Exception as e:
            print(f"❌ 加载模型失败: {e}")
            # 创建新模型
            self.model = LSTMPricePredictor()
            self.model.to(self.device)
    
    def save_model(self, metrics: Dict = None):
        """
        保存模型
        
        Args:
            metrics: 训练指标（可选）
        """
        self.model_path.parent.mkdir(parents=True, exist_ok=True)
        
        checkpoint = {
            'model_state_dict': self.model.state_dict(),
            'num_features': self.model.num_features,
            'hidden_size': self.model.hidden_size,
            'num_layers': self.model.num_layers,
            'dropout': 0.2,
            'scaler': self.scaler,
            'metrics': metrics or {}
        }
        
        torch.save(checkpoint, self.model_path)
        print(f"✅ 模型已保存到 {self.model_path}")
    
    def prepare_sequence(
        self,
        features_list: List[np.ndarray],
        sequence_length: int = 12
    ) -> torch.Tensor:
        """
        准备LSTM输入序列
        
        Args:
            features_list: 特征列表（时序）
            sequence_length: 序列长度（默认12，对应1小时）
            
        Returns:
            torch张量 (1, sequence_length, num_features)
        """
        if len(features_list) < sequence_length:
            # 填充
            padding = [features_list[0]] * (sequence_length - len(features_list))
            features_list = padding + features_list
        
        # 取最后sequence_length个
        sequence = np.array(features_list[-sequence_length:])
        
        # 标准化（如果有scaler）
        if self.scaler is not None:
            sequence = self.scaler.transform(sequence)
        
        # 转换为tensor
        tensor = torch.FloatTensor(sequence).unsqueeze(0)  # 添加batch维度
        return tensor.to(self.device)
    
    def predict(
        self,
        features_sequence: List[np.ndarray]
    ) -> Tuple[str, int, Dict[str, float]]:
        """
        预测交易信号
        
        Args:
            features_sequence: 特征序列（时序）
            
        Returns:
            (signal, confidence, probabilities)
        """
        if self.model is None:
            raise RuntimeError("模型未初始化")
        
        # 准备输入
        x = self.prepare_sequence(features_sequence)
        
        # 预测
        self.model.eval()
        with torch.no_grad():
            probabilities = self.model(x)
            
            # 获取概率
            probs = probabilities.cpu().numpy()[0]
            prob_dict = {
                "buy_prob": float(probs[0]),
                "hold_prob": float(probs[1]),
                "sell_prob": float(probs[2])
            }
            
            # 获取信号
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
        learning_rate: float = 0.001
    ):
        """
        训练模型
        
        Args:
            train_loader: 训练数据加载器
            val_loader: 验证数据加载器
            num_epochs: 训练轮数
            learning_rate: 学习率
        """
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
                
                # 前向传播
                outputs = self.model(batch_x)
                loss = criterion(outputs, batch_y)
                
                # 反向传播
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
            
            # 学习率调整
            scheduler.step(avg_val_loss)
            
            # 保存最佳模型
            if avg_val_loss < best_val_loss:
                best_val_loss = avg_val_loss
                self.save_model({
                    'epoch': epoch + 1,
                    'train_loss': avg_train_loss,
                    'val_loss': avg_val_loss,
                    'accuracy': accuracy
                })
                print("✅ 最佳模型已保存")

