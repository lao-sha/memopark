import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePolkadotApi } from './usePolkadotApi';
import { useWallet } from './useWallet';
import { App } from 'antd';
import { signAndSendLocalFromKeystore } from '../lib/polkadot-safe';

/**
 * 函数级中文注释：通讯录相关数据查询和操作 Hooks
 *
 * 提供功能：
 * - 联系人列表查询
 * - 分组列表查询
 * - 黑名单查询
 * - 好友申请查询
 * - 各种操作mutation（添加、删除、更新等）
 */

// 联系人状态映射
const FRIEND_STATUS_MAP = {
  0: 'OneWay',
  1: 'Mutual',
  2: 'Pending'
};

/**
 * 函数级中文注释：查询用户的联系人列表
 */
export const useContactsQuery = (account?: string) => {
  const { api, isReady } = usePolkadotApi();

  return useQuery({
    queryKey: ['contacts', account],
    queryFn: async () => {
      if (!api || !account || !isReady) return [];

      try {
        // 查询联系人列表
        const entries = await api.query.contacts.contacts.entries(account);

        const contacts = await Promise.all(
          entries.map(async ([key, value]) => {
            const contactAccount = key.args[1].toString();
            const contactInfo = value.unwrap();

            return {
              account: contactAccount,
              alias: contactInfo.alias.isSome ? contactInfo.alias.unwrap().toUtf8() : null,
              groups: contactInfo.groups.map((g: any) => g.toUtf8()),
              friendStatus: FRIEND_STATUS_MAP[contactInfo.friendStatus.type] || 'OneWay',
              addedAt: contactInfo.addedAt.toNumber(),
              updatedAt: contactInfo.updatedAt.toNumber()
            };
          })
        );

        return contacts;
      } catch (error) {
        console.error('查询联系人失败:', error);
        return [];
      }
    },
    enabled: !!api && !!account && isReady,
    refetchInterval: 30000, // 30秒自动刷新
    staleTime: 10000
  });
};

/**
 * 函数级中文注释：查询用户的分组列表
 */
export const useGroupsQuery = (account?: string) => {
  const { api, isReady } = usePolkadotApi();

  return useQuery({
    queryKey: ['groups', account],
    queryFn: async () => {
      if (!api || !account || !isReady) return [];

      try {
        // 查询分组列表
        const entries = await api.query.contacts.groups.entries(account);

        const groups = entries.map(([key, value]) => {
          const groupName = key.args[1].toUtf8();
          const groupInfo = value.unwrap();

          return {
            name: groupName,
            memberCount: groupInfo.memberCount.toNumber(),
            createdAt: groupInfo.createdAt.toNumber()
          };
        });

        return groups;
      } catch (error) {
        console.error('查询分组失败:', error);
        return [];
      }
    },
    enabled: !!api && !!account && isReady,
    refetchInterval: 30000,
    staleTime: 10000
  });
};

/**
 * 函数级中文注释：查询分组成员列表
 */
export const useGroupMembersQuery = (account?: string, groupName?: string) => {
  const { api, isReady } = usePolkadotApi();

  return useQuery({
    queryKey: ['groupMembers', account, groupName],
    queryFn: async () => {
      if (!api || !account || !groupName || !isReady) return [];

      try {
        // 查询分组成员
        const members = await api.query.contacts.groupMembers(account, groupName);
        return members.map((member: any) => member.toString());
      } catch (error) {
        console.error('查询分组成员失败:', error);
        return [];
      }
    },
    enabled: !!api && !!account && !!groupName && isReady
  });
};

/**
 * 函数级中文注释：查询用户的黑名单
 */
export const useBlacklistQuery = (account?: string) => {
  const { api, isReady } = usePolkadotApi();

  return useQuery({
    queryKey: ['blacklist', account],
    queryFn: async () => {
      if (!api || !account || !isReady) return [];

      try {
        // 查询黑名单
        const entries = await api.query.contacts.blacklist.entries(account);

        const blacklist = entries.map(([key, value]) => {
          const blockedAccount = key.args[1].toString();
          const blockedInfo = value.unwrap();

          return {
            account: blockedAccount,
            reason: blockedInfo.reason.isSome ? blockedInfo.reason.unwrap().toUtf8() : null,
            blockedAt: blockedInfo.blockedAt.toNumber()
          };
        });

        return blacklist;
      } catch (error) {
        console.error('查询黑名单失败:', error);
        return [];
      }
    },
    enabled: !!api && !!account && isReady,
    refetchInterval: 30000,
    staleTime: 10000
  });
};

/**
 * 函数级中文注释：查询好友申请列表
 */
export const useFriendRequestsQuery = (account?: string) => {
  const { api, isReady } = usePolkadotApi();

  return useQuery({
    queryKey: ['friendRequests', account],
    queryFn: async () => {
      if (!api || !account || !isReady) return [];

      try {
        // 查询收到的好友申请
        const entries = await api.query.contacts.friendRequests.entries(account);

        const requests = entries.map(([key, value]) => {
          const requesterAccount = key.args[1].toString();
          const requestedAt = value.unwrap().toNumber();

          return {
            from: requesterAccount,
            requestedAt: requestedAt
          };
        });

        return requests;
      } catch (error) {
        console.error('查询好友申请失败:', error);
        return [];
      }
    },
    enabled: !!api && !!account && isReady,
    refetchInterval: 15000, // 好友申请更频繁刷新
    staleTime: 5000
  });
};

/**
 * 函数级中文注释：添加联系人
 */
export const useAddContact = () => {
  const { account } = useWallet();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  return useMutation({
    mutationFn: async (params: {
      contact: string;
      alias?: string;
      groups?: string[];
    }) => {
      if (!account) throw new Error('未连接钱包');

      const { contact, alias, groups = [] } = params;

      // 使用本地keystore签名
      const hash = await signAndSendLocalFromKeystore(
        'contacts',
        'addContact',
        [contact, alias ? alias : null, groups]
      );

      return hash;
    },
    onSuccess: () => {
      message.success('联系人添加成功');
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (error: any) => {
      message.error(`添加联系人失败: ${error.message}`);
    }
  });
};

/**
 * 函数级中文注释：删除联系人
 */
export const useRemoveContact = () => {
  const { account } = useWallet();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  return useMutation({
    mutationFn: async (contact: string) => {
      if (!account) throw new Error('未连接钱包');

      const hash = await signAndSendLocalFromKeystore(
        'contacts',
        'removeContact',
        [contact]
      );

      return hash;
    },
    onSuccess: () => {
      message.success('联系人删除成功');
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (error: any) => {
      message.error(`删除联系人失败: ${error.message}`);
    }
  });
};

/**
 * 函数级中文注释：创建分组
 */
export const useCreateGroup = () => {
  const { account } = useWallet();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  return useMutation({
    mutationFn: async (groupName: string) => {
      if (!account) throw new Error('未连接钱包');

      const hash = await signAndSendLocalFromKeystore(
        'contacts',
        'createGroup',
        [groupName]
      );

      return hash;
    },
    onSuccess: () => {
      message.success('分组创建成功');
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (error: any) => {
      message.error(`创建分组失败: ${error.message}`);
    }
  });
};

/**
 * 函数级中文注释：发送好友申请
 */
export const useSendFriendRequest = () => {
  const { account } = useWallet();
  const { message } = App.useApp();

  return useMutation({
    mutationFn: async (params: { target: string; message?: string }) => {
      if (!account) throw new Error('未连接钱包');

      const { target, message: msg } = params;

      const hash = await signAndSendLocalFromKeystore(
        'contacts',
        'sendFriendRequest',
        [target, msg || null]
      );

      return hash;
    },
    onSuccess: () => {
      message.success('好友申请发送成功');
    },
    onError: (error: any) => {
      message.error(`发送好友申请失败: ${error.message}`);
    }
  });
};

/**
 * 函数级中文注释：接受好友申请
 */
export const useAcceptFriendRequest = () => {
  const { account } = useWallet();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  return useMutation({
    mutationFn: async (requester: string) => {
      if (!account) throw new Error('未连接钱包');

      const hash = await signAndSendLocalFromKeystore(
        'contacts',
        'acceptFriendRequest',
        [requester]
      );

      return hash;
    },
    onSuccess: () => {
      message.success('好友申请已接受');
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
    onError: (error: any) => {
      message.error(`接受好友申请失败: ${error.message}`);
    }
  });
};

/**
 * 函数级中文注释：拒绝好友申请
 */
export const useRejectFriendRequest = () => {
  const { account } = useWallet();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  return useMutation({
    mutationFn: async (requester: string) => {
      if (!account) throw new Error('未连接钱包');

      const hash = await signAndSendLocalFromKeystore(
        'contacts',
        'rejectFriendRequest',
        [requester]
      );

      return hash;
    },
    onSuccess: () => {
      message.success('好友申请已拒绝');
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
    },
    onError: (error: any) => {
      message.error(`拒绝好友申请失败: ${error.message}`);
    }
  });
};

/**
 * 函数级中文注释：屏蔽用户（加入黑名单）
 */
export const useBlockAccount = () => {
  const { account } = useWallet();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  return useMutation({
    mutationFn: async (params: { target: string; reason?: string }) => {
      if (!account) throw new Error('未连接钱包');

      const { target, reason } = params;

      const hash = await signAndSendLocalFromKeystore(
        'contacts',
        'blockAccount',
        [target, reason || null]
      );

      return hash;
    },
    onSuccess: () => {
      message.success('用户已加入黑名单');
      queryClient.invalidateQueries({ queryKey: ['blacklist'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
    onError: (error: any) => {
      message.error(`屏蔽用户失败: ${error.message}`);
    }
  });
};

/**
 * 函数级中文注释：解除屏蔽用户（从黑名单移除）
 */
export const useUnblockAccount = () => {
  const { account } = useWallet();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  return useMutation({
    mutationFn: async (target: string) => {
      if (!account) throw new Error('未连接钱包');

      const hash = await signAndSendLocalFromKeystore(
        'contacts',
        'unblockAccount',
        [target]
      );

      return hash;
    },
    onSuccess: () => {
      message.success('用户已移出黑名单');
      queryClient.invalidateQueries({ queryKey: ['blacklist'] });
    },
    onError: (error: any) => {
      message.error(`解除屏蔽失败: ${error.message}`);
    }
  });
};