"""
Ensemble集成模型
组合LSTM、Transformer和Random Forest的预测结果
"""

import numpy as np
from typing import Tuple, List, Dict, Optional
from app.models.lstm_model import LSTMModelManager
from app.models.transformer_model import TransformerModelManager
from app.models.random_forest_model import RandomForestModelManager


class EnsemblePredictor:
    """
    集成预测器
    
    策略:
    1. 加权投票（Weighted Voting）
    2. 平均概率（Average Probabilities）
    3. 堆叠（Stacking）
    """
    
    def __init__(
        self,
        use_lstm: bool = True,
        use_transformer: bool = True,
        use_random_forest: bool = True,
        lstm_weight: float = 0.3,
        transformer_weight: float = 0.3,
        random_forest_weight: float = 0.4
    ):
        """
        初始化集成预测器
        
        Args:
            use_lstm: 是否使用LSTM
            use_transformer: 是否使用Transformer
            use_random_forest: 是否使用Random Forest
            lstm_weight: LSTM权重
            transformer_weight: Transformer权重
            random_forest_weight: Random Forest权重
        """
        self.use_lstm = use_lstm
        self.use_transformer = use_transformer
        self.use_random_forest = use_random_forest
        
        # 权重归一化
        total_weight = (
            (lstm_weight if use_lstm else 0) +
            (transformer_weight if use_transformer else 0) +
            (random_forest_weight if use_random_forest else 0)
        )
        
        self.lstm_weight = lstm_weight / total_weight if use_lstm else 0
        self.transformer_weight = transformer_weight / total_weight if use_transformer else 0
        self.random_forest_weight = random_forest_weight / total_weight if use_random_forest else 0
        
        # 初始化模型管理器
        self.lstm_manager = LSTMModelManager() if use_lstm else None
        self.transformer_manager = TransformerModelManager() if use_transformer else None
        self.rf_manager = RandomForestModelManager() if use_random_forest else None
        
        print("🤖 Ensemble集成模型已初始化")
        print(f"   - LSTM: {'✅' if use_lstm else '❌'} (权重: {self.lstm_weight:.2f})")
        print(f"   - Transformer: {'✅' if use_transformer else '❌'} (权重: {self.transformer_weight:.2f})")
        print(f"   - Random Forest: {'✅' if use_random_forest else '❌'} (权重: {self.random_forest_weight:.2f})")
    
    def predict(
        self,
        features_sequence: Optional[List[np.ndarray]] = None,
        features_single: Optional[np.ndarray] = None
    ) -> Tuple[str, int, Dict[str, any]]:
        """
        集成预测
        
        Args:
            features_sequence: 时序特征（用于LSTM和Transformer）
            features_single: 单个特征向量（用于Random Forest）
            
        Returns:
            (signal, confidence, details)
        """
        predictions = {}
        probabilities = {}
        
        # 1. LSTM预测
        if self.use_lstm and self.lstm_manager is not None and features_sequence is not None:
            try:
                signal, confidence, probs = self.lstm_manager.predict(features_sequence)
                predictions['lstm'] = {
                    'signal': signal,
                    'confidence': confidence,
                    'probabilities': probs
                }
                probabilities['lstm'] = np.array([
                    probs['buy_prob'],
                    probs['hold_prob'],
                    probs['sell_prob']
                ])
            except Exception as e:
                print(f"⚠️  LSTM预测失败: {e}")
        
        # 2. Transformer预测
        if self.use_transformer and self.transformer_manager is not None and features_sequence is not None:
            try:
                signal, confidence, probs = self.transformer_manager.predict(features_sequence)
                predictions['transformer'] = {
                    'signal': signal,
                    'confidence': confidence,
                    'probabilities': probs
                }
                probabilities['transformer'] = np.array([
                    probs['buy_prob'],
                    probs['hold_prob'],
                    probs['sell_prob']
                ])
            except Exception as e:
                print(f"⚠️  Transformer预测失败: {e}")
        
        # 3. Random Forest预测
        if self.use_random_forest and self.rf_manager is not None and features_single is not None:
            try:
                signal, confidence, probs = self.rf_manager.predict(features_single)
                predictions['random_forest'] = {
                    'signal': signal,
                    'confidence': confidence,
                    'probabilities': probs
                }
                probabilities['random_forest'] = np.array([
                    probs['buy_prob'],
                    probs['hold_prob'],
                    probs['sell_prob']
                ])
            except Exception as e:
                print(f"⚠️  Random Forest预测失败: {e}")
        
        # 4. 集成预测
        if not probabilities:
            # 如果所有模型都失败，返回默认HOLD
            return "HOLD", 50, {
                'predictions': predictions,
                'ensemble_method': 'fallback',
                'error': 'All models failed'
            }
        
        # 加权平均概率
        ensemble_probs = self._weighted_average_probabilities(probabilities)
        
        # 获取最终信号
        signal_map = {0: "BUY", 1: "HOLD", 2: "SELL"}
        predicted_class = np.argmax(ensemble_probs)
        final_signal = signal_map[predicted_class]
        final_confidence = int(ensemble_probs[predicted_class] * 100)
        
        # 计算一致性
        consensus = self._calculate_consensus(predictions)
        
        details = {
            'predictions': predictions,
            'ensemble_probabilities': {
                'buy_prob': float(ensemble_probs[0]),
                'hold_prob': float(ensemble_probs[1]),
                'sell_prob': float(ensemble_probs[2])
            },
            'consensus': consensus,
            'models_used': list(predictions.keys()),
            'ensemble_method': 'weighted_average'
        }
        
        return final_signal, final_confidence, details
    
    def _weighted_average_probabilities(self, probabilities: Dict[str, np.ndarray]) -> np.ndarray:
        """
        加权平均概率
        
        Args:
            probabilities: {model_name: probability_array}
            
        Returns:
            加权平均后的概率数组
        """
        weighted_sum = np.zeros(3)
        total_weight = 0.0
        
        for model_name, probs in probabilities.items():
            if model_name == 'lstm':
                weight = self.lstm_weight
            elif model_name == 'transformer':
                weight = self.transformer_weight
            elif model_name == 'random_forest':
                weight = self.random_forest_weight
            else:
                weight = 0.0
            
            weighted_sum += probs * weight
            total_weight += weight
        
        # 归一化
        if total_weight > 0:
            return weighted_sum / total_weight
        else:
            return np.array([0.33, 0.34, 0.33])  # 默认均匀分布
    
    def _calculate_consensus(self, predictions: Dict) -> Dict[str, any]:
        """
        计算模型之间的一致性
        
        Args:
            predictions: 各模型的预测结果
            
        Returns:
            一致性统计
        """
        signals = [pred['signal'] for pred in predictions.values()]
        
        # 统计信号分布
        buy_count = signals.count('BUY')
        hold_count = signals.count('HOLD')
        sell_count = signals.count('SELL')
        total = len(signals)
        
        # 最多的信号
        max_count = max(buy_count, hold_count, sell_count)
        consensus_rate = max_count / total if total > 0 else 0
        
        # 是否一致
        is_unanimous = (max_count == total)
        is_majority = (max_count > total / 2)
        
        return {
            'buy_count': buy_count,
            'hold_count': hold_count,
            'sell_count': sell_count,
            'total_models': total,
            'consensus_rate': round(consensus_rate * 100, 2),
            'is_unanimous': is_unanimous,
            'is_majority': is_majority
        }
    
    def get_feature_importance(self) -> Optional[Dict[str, float]]:
        """
        获取特征重要性（仅Random Forest支持）
        """
        if self.use_random_forest and self.rf_manager is not None:
            try:
                return self.rf_manager.get_feature_importance()
            except:
                return None
        return None


class EnsembleModelManager:
    """集成模型管理器"""
    
    def __init__(
        self,
        use_lstm: bool = True,
        use_transformer: bool = True,
        use_random_forest: bool = True
    ):
        """初始化集成模型管理器"""
        self.predictor = EnsemblePredictor(
            use_lstm=use_lstm,
            use_transformer=use_transformer,
            use_random_forest=use_random_forest
        )
    
    def predict(
        self,
        features_sequence: Optional[List[np.ndarray]] = None,
        features_single: Optional[np.ndarray] = None
    ) -> Tuple[str, int, Dict]:
        """
        集成预测
        
        Args:
            features_sequence: 时序特征列表
            features_single: 单个特征向量
            
        Returns:
            (signal, confidence, details)
        """
        return self.predictor.predict(features_sequence, features_single)
    
    def get_model_status(self) -> Dict[str, bool]:
        """
        获取各模型的加载状态
        
        Returns:
            {model_name: is_loaded}
        """
        status = {}
        
        if self.predictor.use_lstm:
            status['lstm'] = (
                self.predictor.lstm_manager is not None and
                self.predictor.lstm_manager.model is not None
            )
        
        if self.predictor.use_transformer:
            status['transformer'] = (
                self.predictor.transformer_manager is not None and
                self.predictor.transformer_manager.model is not None
            )
        
        if self.predictor.use_random_forest:
            status['random_forest'] = (
                self.predictor.rf_manager is not None and
                self.predictor.rf_manager.predictor is not None and
                self.predictor.rf_manager.predictor.is_fitted
            )
        
        return status

