"""
Random Forest分类器
用于交易信号分类和特征重要性分析
"""

from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
import numpy as np
from typing import Tuple, List, Dict, Optional
import pickle
from pathlib import Path


class RandomForestPredictor:
    """
    Random Forest交易信号预测器
    
    优势:
    - 不容易过拟合
    - 可以提供特征重要性
    - 训练速度快
    - 不需要GPU
    """
    
    def __init__(
        self,
        n_estimators: int = 200,
        max_depth: int = 20,
        min_samples_split: int = 10,
        min_samples_leaf: int = 5,
        random_state: int = 42
    ):
        """
        初始化Random Forest模型
        
        Args:
            n_estimators: 树的数量
            max_depth: 最大深度
            min_samples_split: 最小分裂样本数
            min_samples_leaf: 叶子节点最小样本数
            random_state: 随机种子
        """
        self.model = RandomForestClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            min_samples_split=min_samples_split,
            min_samples_leaf=min_samples_leaf,
            random_state=random_state,
            n_jobs=-1,  # 使用所有CPU核心
            class_weight='balanced'  # 处理类别不平衡
        )
        
        self.scaler = StandardScaler()
        self.feature_names = None
        self.is_fitted = False
    
    def fit(self, X: np.ndarray, y: np.ndarray, feature_names: List[str] = None):
        """
        训练模型
        
        Args:
            X: 特征矩阵 (n_samples, n_features)
            y: 标签向量 (n_samples,)
            feature_names: 特征名称列表
        """
        # 标准化特征
        X_scaled = self.scaler.fit_transform(X)
        
        # 训练模型
        self.model.fit(X_scaled, y)
        
        self.feature_names = feature_names
        self.is_fitted = True
        
        print(f"✅ Random Forest训练完成")
        print(f"   - 树数量: {self.model.n_estimators}")
        print(f"   - 训练样本数: {len(X)}")
        print(f"   - 特征数: {X.shape[1]}")
    
    def predict(self, X: np.ndarray) -> Tuple[str, int, Dict[str, float]]:
        """
        预测交易信号
        
        Args:
            X: 特征向量 (1, n_features) 或 (n_features,)
            
        Returns:
            (signal, confidence, probabilities)
        """
        if not self.is_fitted:
            raise RuntimeError("模型未训练")
        
        # 确保是2D数组
        if X.ndim == 1:
            X = X.reshape(1, -1)
        
        # 标准化
        X_scaled = self.scaler.transform(X)
        
        # 预测概率
        probabilities = self.model.predict_proba(X_scaled)[0]
        
        # 映射到信号
        signal_map = {0: "BUY", 1: "HOLD", 2: "SELL"}
        predicted_class = np.argmax(probabilities)
        signal = signal_map[predicted_class]
        confidence = int(probabilities[predicted_class] * 100)
        
        prob_dict = {
            "buy_prob": float(probabilities[0]),
            "hold_prob": float(probabilities[1]),
            "sell_prob": float(probabilities[2])
        }
        
        return signal, confidence, prob_dict
    
    def get_feature_importance(self) -> Dict[str, float]:
        """
        获取特征重要性
        
        Returns:
            特征重要性字典
        """
        if not self.is_fitted:
            raise RuntimeError("模型未训练")
        
        importances = self.model.feature_importances_
        
        if self.feature_names is None:
            feature_names = [f"feature_{i}" for i in range(len(importances))]
        else:
            feature_names = self.feature_names
        
        # 排序
        importance_dict = dict(zip(feature_names, importances))
        sorted_importance = dict(
            sorted(importance_dict.items(), key=lambda x: x[1], reverse=True)
        )
        
        return sorted_importance
    
    def evaluate(self, X_test: np.ndarray, y_test: np.ndarray) -> Dict[str, float]:
        """
        评估模型
        
        Args:
            X_test: 测试特征
            y_test: 测试标签
            
        Returns:
            评估指标
        """
        from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
        
        X_scaled = self.scaler.transform(X_test)
        y_pred = self.model.predict(X_scaled)
        
        metrics = {
            'accuracy': accuracy_score(y_test, y_pred),
            'precision': precision_score(y_test, y_pred, average='weighted'),
            'recall': recall_score(y_test, y_pred, average='weighted'),
            'f1_score': f1_score(y_test, y_pred, average='weighted')
        }
        
        return metrics


class RandomForestModelManager:
    """Random Forest模型管理器"""
    
    def __init__(self, model_path: str = "models/random_forest_model.pkl"):
        """初始化模型管理器"""
        self.model_path = Path(model_path)
        self.predictor: Optional[RandomForestPredictor] = None
        
        # 加载模型（如果存在）
        if self.model_path.exists():
            self.load_model()
        else:
            # 创建新模型
            self.predictor = RandomForestPredictor()
    
    def load_model(self):
        """加载已训练的模型"""
        try:
            with open(self.model_path, 'rb') as f:
                data = pickle.load(f)
            
            self.predictor = data['predictor']
            print(f"✅ Random Forest模型已从 {self.model_path} 加载")
            
        except Exception as e:
            print(f"❌ 加载模型失败: {e}")
            self.predictor = RandomForestPredictor()
    
    def save_model(self, metrics: Dict = None):
        """保存模型"""
        self.model_path.parent.mkdir(parents=True, exist_ok=True)
        
        data = {
            'predictor': self.predictor,
            'metrics': metrics or {}
        }
        
        with open(self.model_path, 'wb') as f:
            pickle.dump(data, f)
        
        print(f"✅ 模型已保存到 {self.model_path}")
    
    def predict(self, features: np.ndarray) -> Tuple[str, int, Dict[str, float]]:
        """
        预测交易信号
        
        Args:
            features: 特征向量
            
        Returns:
            (signal, confidence, probabilities)
        """
        if self.predictor is None or not self.predictor.is_fitted:
            raise RuntimeError("模型未训练或未加载")
        
        return self.predictor.predict(features)
    
    def get_feature_importance(self) -> Dict[str, float]:
        """获取特征重要性"""
        if self.predictor is None or not self.predictor.is_fitted:
            raise RuntimeError("模型未训练或未加载")
        
        return self.predictor.get_feature_importance()
    
    def train_model(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: np.ndarray,
        y_val: np.ndarray,
        feature_names: List[str] = None
    ):
        """
        训练模型
        
        Args:
            X_train: 训练特征
            y_train: 训练标签
            X_val: 验证特征
            y_val: 验证标签
            feature_names: 特征名称
        """
        print("开始训练Random Forest...")
        
        # 训练
        self.predictor.fit(X_train, y_train, feature_names)
        
        # 评估
        train_metrics = self.predictor.evaluate(X_train, y_train)
        val_metrics = self.predictor.evaluate(X_val, y_val)
        
        print("\n训练集评估:")
        for key, value in train_metrics.items():
            print(f"  {key}: {value:.4f}")
        
        print("\n验证集评估:")
        for key, value in val_metrics.items():
            print(f"  {key}: {value:.4f}")
        
        # 特征重要性
        print("\n特征重要性 (Top 10):")
        importance = self.predictor.get_feature_importance()
        for i, (feature, score) in enumerate(list(importance.items())[:10]):
            print(f"  {i+1}. {feature}: {score:.4f}")
        
        # 保存模型
        self.save_model({
            'train_metrics': train_metrics,
            'val_metrics': val_metrics,
            'feature_importance': importance
        })
        
        return val_metrics

