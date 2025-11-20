// 墓位主逝者设置功能实现方案
// 文件：pallets/stardust-grave/src/lib.rs 中新增的代码

// ================================
// 1. 在 Event 枚举中新增事件定义
// ================================

/// 在现有 Event<T: Config> 枚举中添加以下事件：

/// 主逝者已设置
PrimaryDeceasedSet {
    /// 墓位ID
    grave_id: u64,
    /// 设置为主逝者的逝者ID
    deceased_id: u64,
},

/// 主逝者设置已清除
PrimaryDeceasedCleared {
    /// 墓位ID
    grave_id: u64,
},

// ================================
// 2. 在 Error 枚举中新增错误类型
// ================================

/// 在现有 Error<T> 枚举中添加以下错误：

/// 逝者不在该墓位中
DeceasedNotInGrave,

// ================================
// 3. 主逝者设置核心函数实现
// ================================

/// 函数级详细中文注释：设置或清除墓位的主逝者
///
/// ### 业务背景
/// - 墓位可以有多个逝者，但只能有一个"主逝者"用于前端重点展示
/// - 现有系统依赖安葬顺序自动设置主逝者，缺乏灵活性
/// - 此功能允许墓主主动指定哪位逝者作为主要纪念对象
///
/// ### 权限验证
/// - **墓位owner**: 完全控制权，可设置任何已安葬的逝者为主逝者
/// - **墓位管理员**: 需要通过 can_attach 权限检查
/// - **园区管理员**: 可以覆盖设置（管理需要）
/// - **逝者owner**: 无法直接设置，需要通过墓位权限体系
///
/// ### 业务规则
/// 1. **存在性验证**: 被设置的逝者必须已在该墓位中安葬（检查 Interments 存储）
/// 2. **唯一性保证**: 每个墓位最多只有一个主逝者（覆盖写入）
/// 3. **清空支持**: 传入 None 可清除主逝者设置
/// 4. **保持自动机制**: 不影响现有的安葬/起掘自动维护逻辑
///
/// ### 使用场景
/// - 家族墓：指定家族长者为主逝者
/// - 夫妻合葬：指定其中一方为主展示
/// - 纪念墓：指定最重要的纪念对象
/// - 墓位整理：重新调整主逝者优先级
///
/// ### 技术实现
/// - 直接操作 PrimaryDeceasedOf 存储映射
/// - 通过 can_attach 复用现有权限检查逻辑
/// - 发出明确事件供前端监听和同步
///
/// ### 注意事项
/// ⚠️ **重要**：此功能不会影响逝者的实际安葬状态，仅影响主逝者标记
/// ⚠️ **权限**：确保只有有权限的人能操作，防止恶意设置
/// ⚠️ **前端同步**：前端需监听 PrimaryDeceasedSet/Cleared 事件及时更新UI
#[pallet::call_index(67)]  // 使用下一个可用的 call_index
#[pallet::weight(T::WeightInfo::set_primary_deceased())]
pub fn set_primary_deceased(
    origin: OriginFor<T>,
    /// 墓位ID
    id: u64,
    /// 要设置为主逝者的逝者ID，传入 None 表示清除主逝者设置
    deceased_id: Option<u64>,
) -> DispatchResult {
    let who = ensure_signed(origin)?;

    // 1. 验证墓位存在
    let _grave = Self::graves(id).ok_or(Error::<T>::NotFound)?;

    // 2. 权限检查：复用现有的 can_attach 逻辑
    // can_attach 检查：墓主、管理员、或园区管理员
    ensure!(
        Self::can_attach(&who, id)?,
        Error::<T>::PermissionDenied
    );

    match deceased_id {
        Some(target_deceased_id) => {
            // 设置主逝者分支

            // 3. 验证目标逝者存在且已安葬在此墓位
            let interments = Self::interments(id);
            ensure!(
                interments.iter().any(|record| record.deceased_id == target_deceased_id),
                Error::<T>::DeceasedNotInGrave
            );

            // 4. 设置主逝者（覆盖写入，保证唯一性）
            PrimaryDeceasedOf::<T>::insert(id, target_deceased_id);

            // 5. 发出设置事件
            Self::deposit_event(Event::PrimaryDeceasedSet {
                grave_id: id,
                deceased_id: target_deceased_id
            });
        },
        None => {
            // 清除主逝者分支

            // 6. 清除主逝者设置
            PrimaryDeceasedOf::<T>::remove(id);

            // 7. 发出清除事件
            Self::deposit_event(Event::PrimaryDeceasedCleared {
                grave_id: id
            });
        }
    }

    Ok(())
}

// ================================
// 4. 查询函数实现
// ================================

impl<T: Config> Pallet<T> {
    /// 获取墓位的主逝者ID
    ///
    /// ### 功能说明
    /// - 查询指定墓位当前设置的主逝者
    /// - 不验证逝者是否仍存在于墓位中（起掘后可能不同步）
    ///
    /// ### 参数
    /// - `grave_id`: 墓位ID
    ///
    /// ### 返回值
    /// - `Some(deceased_id)`: 主逝者ID
    /// - `None`: 未设置主逝者
    ///
    /// ### 使用场景
    /// - 前端查询墓位主逝者进行展示
    /// - 后端业务逻辑判断主逝者状态
    /// - RPC 接口提供给 dApp 调用
    pub fn primary_deceased_of(grave_id: u64) -> Option<u64> {
        PrimaryDeceasedOf::<T>::get(grave_id)
    }

    /// 获取墓位的主逝者详细信息（跨 pallet 查询）
    ///
    /// ### 功能说明
    /// - 通过 DeceasedProvider trait 获取主逝者的完整信息
    /// - 一次调用获取 ID + 详细信息，提高前端查询效率
    ///
    /// ### 参数
    /// - `grave_id`: 墓位ID
    ///
    /// ### 返回值
    /// - `Some((deceased_id, deceased_info))`: 主逝者ID及其详细信息
    /// - `None`: 未设置主逝者或逝者信息不存在
    ///
    /// ### 注意事项
    /// ⚠️ **跨 pallet 依赖**：需要 DeceasedProvider trait 支持
    /// ⚠️ **性能考虑**：涉及两次存储读取，谨慎在循环中使用
    pub fn primary_deceased_details(grave_id: u64) -> Option<(u64, DeceasedInfo)> {
        if let Some(deceased_id) = Self::primary_deceased_of(grave_id) {
            // 通过 DeceasedProvider trait 获取逝者详细信息
            T::DeceasedProvider::get_deceased_info(deceased_id)
                .map(|info| (deceased_id, info))
        } else {
            None
        }
    }

    /// 检查指定逝者是否为墓位的主逝者
    ///
    /// ### 功能说明
    /// - 快速判断某个逝者是否被设置为指定墓位的主逝者
    /// - 避免前端需要先查询主逝者ID再比较的两步操作
    ///
    /// ### 参数
    /// - `grave_id`: 墓位ID
    /// - `deceased_id`: 逝者ID
    ///
    /// ### 返回值
    /// - `true`: 该逝者是主逝者
    /// - `false`: 该逝者不是主逝者或未设置主逝者
    pub fn is_primary_deceased(grave_id: u64, deceased_id: u64) -> bool {
        Self::primary_deceased_of(grave_id) == Some(deceased_id)
    }
}

// ================================
// 5. Weight 函数实现
// ================================

/// 在 WeightInfo trait 中新增 weight 函数声明：

pub trait WeightInfo {
    // ... 现有函数声明 ...

    /// 设置主逝者操作的 weight 计算
    ///
    /// ### Weight 分析
    /// - **Reads**: 3 次读取
    ///   1. Graves 存储：验证墓位存在
    ///   2. Interments 存储：验证逝者在墓位中
    ///   3. PrimaryDeceasedOf 存储：当前主逝者状态（可能）
    /// - **Writes**: 1 次写入
    ///   1. PrimaryDeceasedOf 存储：设置或删除主逝者
    /// - **Logic**: 轻量级逻辑运算和权限检查
    fn set_primary_deceased() -> Weight;
}

/// 在具体的 weight 实现中添加：

impl WeightInfo for () {
    fn set_primary_deceased() -> Weight {
        T::DbWeight::get().reads(3)        // graves + interments + primary_deceased_of
            .saturating_add(T::DbWeight::get().writes(1))  // primary_deceased_of
            .saturating_add(Weight::from_parts(15_000, 0)) // 逻辑运算 + 权限检查
    }
}

// ================================
// 6. RPC 接口扩展建议
// ================================

/// 建议在 runtime API 中添加以下接口供前端调用：

/// RPC 查询墓位主逝者信息
///
/// ### 接口设计
/// ```typescript
/// // 前端 TypeScript 接口
/// interface GravePrimaryDeceasedAPI {
///   // 获取主逝者ID
///   getPrimaryDeceased(graveId: number): Promise<number | null>
///
///   // 获取主逝者详细信息
///   getPrimaryDeceasedDetails(graveId: number): Promise<{
///     deceasedId: number,
///     name: string,
///     gender: 'M' | 'F',
///     birthDate?: string,
///     deathDate?: string,
///     mainImageCid?: string
///   } | null>
///
///   // 检查是否为主逝者
///   isPrimaryDeceased(graveId: number, deceasedId: number): Promise<boolean>
/// }
/// ```

// ================================
// 7. 前端集成指南
// ================================

/// ### 前端使用示例
///
/// ```typescript
/// // 1. 查询墓位主逝者
/// const primaryDeceasedId = await api.query.stardustGrave.primaryDeceasedOf(graveId)
///
/// // 2. 设置主逝者
/// const tx = api.tx.stardustGrave.setPrimaryDeceased(graveId, deceasedId)
/// await tx.signAndSend(userAccount)
///
/// // 3. 清除主逝者
/// const clearTx = api.tx.stardustGrave.setPrimaryDeceased(graveId, null)
/// await clearTx.signAndSend(userAccount)
///
/// // 4. 监听事件
/// api.query.system.events((events) => {
///   events.forEach(({ event }) => {
///     if (api.events.stardustGrave.PrimaryDeceasedSet.is(event)) {
///       const [graveId, deceasedId] = event.data
///       console.log(`墓位 ${graveId} 的主逝者设置为 ${deceasedId}`)
///     }
///     if (api.events.stardustGrave.PrimaryDeceasedCleared.is(event)) {
///       const [graveId] = event.data
///       console.log(`墓位 ${graveId} 的主逝者设置已清除`)
///     }
///   })
/// })
/// ```

// ================================
// 8. 业务流程优化建议
// ================================

/// ### 建议的前端 UI 设计
///
/// 1. **墓位详情页**
///    - 显示主逝者头像和名称作为墓位封面
///    - 提供"设为主逝者"按钮（仅对有权限用户显示）
///    - 主逝者旁显示特殊标识（如王冠图标）
///
/// 2. **逝者列表页**
///    - 主逝者排在列表顶部
///    - 主逝者条目有视觉差异化（边框、背景色等）
///    - 提供快速切换主逝者的操作
///
/// 3. **安葬流程**
///    - 在安葬时询问"是否设为主逝者"
///    - 自动检测当前是否已有主逝者，给出合适提示
///
/// ### 业务逻辑优化
///
/// 1. **智能默认设置**
///    - 首次安葬时自动设为主逝者（现有逻辑）
///    - 提供用户在安葬时主动选择的选项
///
/// 2. **权限提示优化**
///    - 无权限用户查看时隐藏设置按钮
///    - 权限不足时显示友好的权限说明
///
/// 3. **数据一致性保护**
///    - 主逝者被起掘时，前端及时更新显示
///    - 定期检查主逝者是否仍在墓位中

// ================================
// 9. 测试用例建议
// ================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_set_primary_deceased_success() {
        // 测试正常设置主逝者
        // 1. 创建墓位
        // 2. 安葬逝者
        // 3. 设置主逝者
        // 4. 验证设置成功
        // 5. 验证事件发出
    }

    #[test]
    fn test_set_primary_deceased_permission_denied() {
        // 测试权限不足的情况
        // 1. 创建墓位（用户A）
        // 2. 安葬逝者
        // 3. 用户B尝试设置主逝者
        // 4. 验证失败并返回权限错误
    }

    #[test]
    fn test_set_primary_deceased_not_in_grave() {
        // 测试逝者不在墓位中的情况
        // 1. 创建墓位
        // 2. 尝试设置未安葬的逝者为主逝者
        // 3. 验证失败并返回 DeceasedNotInGrave 错误
    }

    #[test]
    fn test_clear_primary_deceased() {
        // 测试清除主逝者
        // 1. 创建墓位并设置主逝者
        // 2. 清除主逝者（传入None）
        // 3. 验证主逝者被清除
        // 4. 验证清除事件发出
    }

    #[test]
    fn test_primary_deceased_after_exhumation() {
        // 测试主逝者被起掘后的自动重选
        // 1. 创建墓位，安葬多个逝者
        // 2. 手动设置主逝者
        // 3. 起掘主逝者
        // 4. 验证系统自动重选新的主逝者（按slot最小原则）
    }
}

// ================================
// 总结：实现要点
// ================================

/// 此方案的核心优势：
///
/// 1. **最小侵入性**：复用现有权限体系和存储结构
/// 2. **向后兼容**：保持现有自动维护机制不变
/// 3. **权限安全**：通过 can_attach 确保只有有权限的人能操作
/// 4. **前端友好**：提供明确的事件和查询接口
/// 5. **业务合理**：允许灵活指定主逝者，满足实际需求
///
/// 实现此方案需要的修改点：
/// 1. Event 枚举中添加 2 个事件
/// 2. Error 枚举中添加 1 个错误类型
/// 3. 新增 1 个 extrinsic 函数 (set_primary_deceased)
/// 4. 新增 3 个查询辅助函数
/// 5. WeightInfo trait 中添加 weight 计算
///
/// 此方案设计合理，技术可行，建议优先实现。