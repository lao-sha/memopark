// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Mock Uniswap Router for testing
/// @notice 简化的 Uniswap Router 模拟，用于测试
contract MockUniswapRouter {
    /// @notice 模拟精确输入的代币交换
    /// @dev 简单的 1:1 兑换，实际 Uniswap 会根据流动性池计算
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require(deadline >= block.timestamp, "Expired");
        require(path.length >= 2, "Invalid path");
        require(amountIn > 0, "Amount must be > 0");
        
        // 从调用者转入 tokenIn
        IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);
        
        // 简化：假设 1:1 兑换（实际应该根据流动性池）
        uint256 amountOut = amountIn; // 简化计算
        
        require(amountOut >= amountOutMin, "Insufficient output amount");
        
        // 转出 tokenOut 给接收者
        IERC20(path[path.length - 1]).transfer(to, amountOut);
        
        // 返回金额数组
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        amounts[path.length - 1] = amountOut;
        
        return amounts;
    }
}

