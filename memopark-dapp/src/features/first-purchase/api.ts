/**
 * 函数级详细中文注释：首购API接口
 */

import axios from 'axios';

// API基础URL（从环境变量读取）
const API_BASE_URL = import.meta.env.VITE_FIRST_PURCHASE_API_URL || 'http://localhost:3100/api/first-purchase';

export const firstPurchaseApi = {
  /**
   * 函数级详细中文注释：创建首购订单
   */
  async createOrder(data: {
    walletAddress: string;
    amount: number;
    referralCode?: string;
  }) {
    const response = await axios.post(`${API_BASE_URL}/create`, data);
    
    if (!response.data.success) {
      throw new Error(response.data.error || '创建订单失败');
    }
    
    return response.data.data;
  },

  /**
   * 函数级详细中文注释：查询订单状态
   */
  async getOrderStatus(orderId: string) {
    const response = await axios.get(`${API_BASE_URL}/status/${orderId}`);
    
    if (!response.data.success) {
      throw new Error(response.data.error || '查询订单失败');
    }
    
    return response.data.data;
  },

  /**
   * 函数级详细中文注释：检查地址是否已首购
   */
  async checkFirstPurchase(walletAddress: string) {
    const response = await axios.get(`${API_BASE_URL}/check/${walletAddress}`);
    
    if (!response.data.success) {
      throw new Error(response.data.error || '检查首购状态失败');
    }
    
    return response.data.data;
  },

  /**
   * 函数级详细中文注释：查询可用做市商状态
   * 
   * 功能：
   * - 查询所有活跃做市商
   * - 返回服务状态、可用余额、冻结金额等信息
   * - 前端根据此信息判断是否可以创建订单
   */
  async getAvailableMarketMakers() {
    const response = await axios.get(`${API_BASE_URL}/market-makers/available`);
    
    if (!response.data.success) {
      throw new Error(response.data.error || '查询做市商失败');
    }
    
    return response.data.data;
  },

  /**
   * 函数级详细中文注释：查询指定做市商详情
   */
  async getMarketMakerInfo(mmId: number) {
    const response = await axios.get(`${API_BASE_URL}/market-makers/${mmId}`);
    
    if (!response.data.success) {
      throw new Error(response.data.error || '查询做市商详情失败');
    }
    
    return response.data.data;
  },
};

