/**
 * 函数级详细中文注释：epay支付网关服务模块
 * 
 * 职责：
 * 1. 生成支付链接
 * 2. 验证支付回调签名
 * 3. 处理支付结果
 */

const md5 = require('md5');
const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

class EpayService {
    constructor() {
        this.pid = config.epay.pid;
        this.key = config.epay.key;
        this.gateway = config.epay.gateway;
        this.notifyUrl = config.epay.notifyUrl;
        this.returnUrl = config.epay.returnUrl;
    }

    /**
     * 函数级详细中文注释：生成支付签名
     * 
     * @param {Object} params - 支付参数
     * @returns {String} - MD5签名
     */
    generateSign(params) {
        // 按key排序
        const sortedKeys = Object.keys(params).sort();
        
        // 拼接字符串
        const signStr = sortedKeys
            .filter(key => params[key] !== '' && key !== 'sign')
            .map(key => `${key}=${params[key]}`)
            .join('&');
        
        // 加上key
        const signWithKey = signStr + this.key;
        
        // MD5加密
        return md5(signWithKey);
    }

    /**
     * 函数级详细中文注释：验证回调签名
     * 
     * @param {Object} params - 回调参数
     * @returns {Boolean} - 签名是否有效
     */
    verifySign(params) {
        const receivedSign = params.sign;
        const calculatedSign = this.generateSign(params);
        
        const isValid = receivedSign === calculatedSign;
        
        if (!isValid) {
            logger.error('签名验证失败', {
                received: receivedSign,
                calculated: calculatedSign,
            });
        }
        
        return isValid;
    }

    /**
     * 函数级详细中文注释：创建支付订单
     * 
     * @param {Object} orderData - 订单数据
     * @param {String} orderData.orderId - 订单号
     * @param {Number} orderData.amount - 支付金额（CNY）
     * @param {String} orderData.name - 商品名称
     * @returns {String} - 支付URL
     */
    createPayment(orderData) {
        const { orderId, amount, name } = orderData;
        
        // 构建支付参数
        const params = {
            pid: this.pid,
            type: 'alipay', // 支持: alipay, wxpay
            out_trade_no: orderId,
            notify_url: this.notifyUrl,
            return_url: this.returnUrl,
            name: name || 'MEMO首购',
            money: amount.toFixed(2),
            sitename: 'MemoPark',
        };
        
        // 生成签名
        params.sign = this.generateSign(params);
        params.sign_type = 'MD5';
        
        // 构建支付URL
        const queryString = Object.keys(params)
            .map(key => `${key}=${encodeURIComponent(params[key])}`)
            .join('&');
        
        const paymentUrl = `${this.gateway}/submit.php?${queryString}`;
        
        logger.info('支付订单已创建', {
            orderId,
            amount,
            paymentUrl,
        });
        
        return paymentUrl;
    }

    /**
     * 函数级详细中文注释：处理支付回调
     * 
     * @param {Object} callbackData - 回调数据
     * @returns {Object} - 处理结果
     */
    handleCallback(callbackData) {
        // 验证签名
        if (!this.verifySign(callbackData)) {
            return {
                success: false,
                error: '签名验证失败',
            };
        }
        
        // 验证支付状态
        if (callbackData.trade_status !== 'TRADE_SUCCESS') {
            return {
                success: false,
                error: '支付未成功',
                status: callbackData.trade_status,
            };
        }
        
        // 提取订单信息
        const result = {
            success: true,
            orderId: callbackData.out_trade_no,
            tradeNo: callbackData.trade_no,
            amount: parseFloat(callbackData.money),
            buyerId: callbackData.buyer_id || '',
            tradeStatus: callbackData.trade_status,
        };
        
        logger.info('支付回调验证成功', result);
        
        return result;
    }

    /**
     * 函数级详细中文注释：查询订单状态
     * 
     * @param {String} orderId - 订单号
     * @returns {Object} - 订单状态
     */
    async queryOrder(orderId) {
        try {
            const params = {
                act: 'order',
                pid: this.pid,
                key: this.key,
                out_trade_no: orderId,
            };
            
            const response = await axios.get(`${this.gateway}/api.php`, { params });
            
            if (response.data.code === 1) {
                return {
                    success: true,
                    status: response.data.status,
                    amount: response.data.money,
                };
            } else {
                return {
                    success: false,
                    error: response.data.msg,
                };
            }
        } catch (error) {
            logger.error('查询订单失败', { orderId, error: error.message });
            return {
                success: false,
                error: error.message,
            };
        }
    }
}

module.exports = new EpayService();

