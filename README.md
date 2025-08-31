# Substrate Node Template

A fresh [Substrate](https://substrate.io/) node, ready for hacking :rocket:

A standalone version of this template is available for each release of Polkadot
in the [Substrate Developer Hub Parachain
Template](https://github.com/substrate-developer-hub/substrate-node-template/)
repository. The parachain template is generated directly at each Polkadot
release branch from the [Solochain Template in
Substrate](https://github.com/paritytech/polkadot-sdk/tree/master/templates/solochain)
upstream

It is usually best to use the stand-alone version to start a new project. All
bugs, suggestions, and feature requests should be made upstream in the
[Substrate](https://github.com/paritytech/polkadot-sdk/tree/master/substrate)
repository.

## Getting Started

Depending on your operating system and Rust version, there might be additional
packages required to compile this template. Check the
[Install](https://docs.substrate.io/install/) instructions for your platform for
the most common dependencies. Alternatively, you can use one of the [alternative
installation](#alternatives-installations) options.

Fetch solochain template code:

```sh
git clone https://github.com/paritytech/polkadot-sdk-solochain-template.git solochain-template

cd solochain-template
```

### Build

🔨 Use the following command to build the node without launching it:

```sh
cargo build --release
```

### Embedded Docs

After you build the project, you can use the following command to explore its
parameters and subcommands:

```sh
./target/release/solochain-template-node -h
```

You can generate and view the [Rust
Docs](https://doc.rust-lang.org/cargo/commands/cargo-doc.html) for this template
with this command:

```sh
cargo +nightly doc --open
```

### Single-Node Development Chain

The following command starts a single-node development chain that doesn't
persist state:

```sh
./target/release/solochain-template-node --dev
```

To purge the development chain's state, run the following command:

```sh
./target/release/solochain-template-node purge-chain --dev
```

To start the development chain with detailed logging, run the following command:

```sh
RUST_BACKTRACE=1 ./target/release/solochain-template-node -ldebug --dev
```

Development chains:

- Maintain state in a `tmp` folder while the node is running.
- Use the **Alice** and **Bob** accounts as default validator authorities.
- Use the **Alice** account as the default `sudo` account.
- Are preconfigured with a genesis state (`/node/src/chain_spec.rs`) that
  includes several pre-funded development accounts.


To persist chain state between runs, specify a base path by running a command
similar to the following:

```sh
// Create a folder to use as the db base path
$ mkdir my-chain-state

// Use of that folder to store the chain state
$ ./target/release/solochain-template-node --dev --base-path ./my-chain-state/

// Check the folder structure created inside the base path after running the chain
$ ls ./my-chain-state
chains
$ ls ./my-chain-state/chains/
dev
$ ls ./my-chain-state/chains/dev
db keystore network
```

### Connect with Polkadot-JS Apps Front-End

After you start the node template locally, you can interact with it using the
hosted version of the [Polkadot/Substrate
Portal](https://polkadot.js.org/apps/#/explorer?rpc=ws://localhost:9944)
front-end by connecting to the local node endpoint. A hosted version is also
available on [IPFS](https://dotapps.io/). You can
also find the source code and instructions for hosting your own instance in the
[`polkadot-js/apps`](https://github.com/polkadot-js/apps) repository.

### Multi-Node Local Testnet

If you want to see the multi-node consensus algorithm in action, see [Simulate a
network](https://docs.substrate.io/tutorials/build-a-blockchain/simulate-network/).

## Template Structure

A Substrate project such as this consists of a number of components that are
spread across a few directories.

### Node

A blockchain node is an application that allows users to participate in a
blockchain network. Substrate-based blockchain nodes expose a number of
capabilities:

- Networking: Substrate nodes use the [`libp2p`](https://libp2p.io/) networking
  stack to allow the nodes in the network to communicate with one another.
- Consensus: Blockchains must have a way to come to
  [consensus](https://docs.substrate.io/fundamentals/consensus/) on the state of
  the network. Substrate makes it possible to supply custom consensus engines
  and also ships with several consensus mechanisms that have been built on top
  of [Web3 Foundation
  research](https://research.web3.foundation/Polkadot/protocols/NPoS).
- RPC Server: A remote procedure call (RPC) server is used to interact with
  Substrate nodes.

There are several files in the `node` directory. Take special note of the
following:

- [`chain_spec.rs`](./node/src/chain_spec.rs): A [chain
  specification](https://docs.substrate.io/build/chain-spec/) is a source code
  file that defines a Substrate chain's initial (genesis) state. Chain
  specifications are useful for development and testing, and critical when
  architecting the launch of a production chain. Take note of the
  `development_config` and `testnet_genesis` functions. These functions are
  used to define the genesis state for the local development chain
  configuration. These functions identify some [well-known
  accounts](https://docs.substrate.io/reference/command-line-tools/subkey/) and
  use them to configure the blockchain's initial state.
- [`service.rs`](./node/src/service.rs): This file defines the node
  implementation. Take note of the libraries that this file imports and the
  names of the functions it invokes. In particular, there are references to
  consensus-related topics, such as the [block finalization and
  forks](https://docs.substrate.io/fundamentals/consensus/#finalization-and-forks)
  and other [consensus
  mechanisms](https://docs.substrate.io/fundamentals/consensus/#default-consensus-models)
  such as Aura for block authoring and GRANDPA for finality.


### Runtime

In Substrate, the terms "runtime" and "state transition function" are analogous.
Both terms refer to the core logic of the blockchain that is responsible for
validating blocks and executing the state changes they define. The Substrate
project in this repository uses
[FRAME](https://docs.substrate.io/learn/runtime-development/#frame) to construct
a blockchain runtime. FRAME allows runtime developers to declare domain-specific
logic in modules called "pallets". At the heart of FRAME is a helpful [macro
language](https://docs.substrate.io/reference/frame-macros/) that makes it easy
to create pallets and flexibly compose them to create blockchains that can
address [a variety of needs](https://substrate.io/ecosystem/projects/).

Review the [FRAME runtime implementation](./runtime/src/lib.rs) included in this
template and note the following:

- This file configures several pallets to include in the runtime. Each pallet
  configuration is defined by a code block that begins with `impl
  $PALLET_NAME::Config for Runtime`.
- The pallets are composed into a single runtime by way of the
  [#[runtime]](https://paritytech.github.io/polkadot-sdk/master/frame_support/attr.runtime.html)
  macro, which is part of the [core FRAME pallet
  library](https://docs.substrate.io/reference/frame-pallets/#system-pallets).

### Pallets

The runtime in this project is constructed using many FRAME pallets that ship
with [the Substrate
repository](https://github.com/paritytech/polkadot-sdk/tree/master/substrate/frame) and a
template pallet that is [defined in the
`pallets`](./pallets/template/src/lib.rs) directory.

A FRAME pallet is comprised of a number of blockchain primitives, including:

- Storage: FRAME defines a rich set of powerful [storage
  abstractions](https://docs.substrate.io/build/runtime-storage/) that makes it
  easy to use Substrate's efficient key-value database to manage the evolving
  state of a blockchain.
- Dispatchables: FRAME pallets define special types of functions that can be
  invoked (dispatched) from outside of the runtime in order to update its state.
- Events: Substrate uses
  [events](https://docs.substrate.io/build/events-and-errors/) to notify users
  of significant state changes.
- Errors: When a dispatchable fails, it returns an error.

Each pallet has its own `Config` trait which serves as a configuration interface
to generically define the types and parameters it depends on.

## Alternatives Installations

Instead of installing dependencies and building this source directly, consider
the following alternatives.

### Nix

Install [nix](https://nixos.org/) and
[nix-direnv](https://github.com/nix-community/nix-direnv) for a fully
plug-and-play experience for setting up the development environment. To get all
the correct dependencies, activate direnv `direnv allow`.

### Docker

Please follow the [Substrate Docker instructions
here](https://github.com/paritytech/polkadot-sdk/blob/master/substrate/docker/README.md) to
build the Docker container with the Substrate Node Template binary.

## memopark 定制说明（联盟托管结算 + 15 层压缩）

本工程在模板基础上集成了纪念园业务与联盟计酬，核心模块：
- `pallet-memo-offerings`：供奉目录与下单记录；Hook 联动统计与联盟计酬。
- `pallet-memo-referrals`：极简推荐关系源，仅存 `SponsorOf` 与只读遍历。
- `pallet-memo-affiliate`：托管结算与 15 层压缩分配（每层 5%，不足并入国库；10% 销毁，15% 国库）。
- `pallet-ledger`：按周的活跃标记与累计统计（明细/排行交由 Subsquid）。

### 供奉 → 联盟托管流程
1. 用户在 `pallet-memo-offerings::offer` 下单；运行时将入金路由到“联盟托管账户”（PalletId 派生）。
2. Hook 同步：
   - 记录供奉流水与媒体；
   - 标记有效供奉期（Timed 连续 w 周，Instant 仅入金当周）；
   - 调用 `pallet-memo-affiliate::report(who, amount, meta, now, duration_weeks)` 进行“记账式”分配：
     - 从下往上动态压缩寻找最多 15 个合格上级（处于有效期且直推有效数 ≥ 3×层数），为其累计应得；
     - 不足 15 层的预算并入国库；同步累计 10% 销毁与 15% 国库基础份额。
3. 周期末（或任意时点）分页结算：
   - 调用 `pallet-memo-affiliate::settle(week, max_pay)`，从托管账户按索引分页向应得账户划拨，然后支付当周销毁与国库并清理索引。

### 治理参数（默认）
- 层数/比例：`MaxLevels=15`，`LevelRateBps=500`（5%/层），`BurnBps=1000`（10%），`TreasuryBps=1500`（15%）。
- 有效期与阈值：以周为单位（`BlocksPerWeek=100_800`），直推有效阈值 `PerLevelNeed=3`。
- 结算模式：`SettlementMode=Escrow`（托管；支持治理切换到 `Immediate` 即时）。

### 关键账户
- 黑洞：运行时常量 `BurnAccount`（b"memo/burn" 派生）。
- 国库：运行时常量 `PlatformAccount`（可替换为治理账户）。
- 联盟托管：运行时 `DonationAccountResolver` 路由到 PalletId 托管账户。

### 开发者提示
- 推荐关系去耦：仅在 `pallet-memo-referrals` 维护一次性绑定；联盟只读，不触碰资金。
- 事件齐全，重查询建议使用索引器（如 SubQuery）。
- 转账统一使用 `transfer_keep_alive`，避免误杀账户；结算与到期处理均支持分页。