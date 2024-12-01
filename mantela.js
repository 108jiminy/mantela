'use strict';

const nodes = [];
const edges = [];

// スタートノードとターゲットノードのIDを保持
let startNodeId = null;
let targetNodeId = null;

async function
main(first)
{
    if (!first)
        return;

    const queue = [ first ];
    const visited = [];
    while (queue.length > 0) {
        try {
            const cur = queue.shift();
            const k = await (await fetch(cur, { mode: 'cors' })).json();
            if (visited.some(e => e === cur))
                continue;
            visited.push(cur);

            const me = {
                id: k.aboutMe.identifier,
                label: k.aboutMe.name,
                type: 'provider',
            };
            if (!nodes.some(q => q.id === me.id)) {
                nodes.push(me);
            }

            k.extensions.forEach(e => {
                const node = {
                    id: me.id + Math.random(),
                    label: e.name,
                    color: 'orange',
                    type: 'extension',
                };
                nodes.push(node);
                const edge = {
                    from: me.id,
                    to: node.id,
                    label: e.extension,
                };
                edges.push(edge);
            });
            k.providers.forEach(e => {
                if (!nodes.some(q => q.id === e.identifier)) {
                    const node = {
                        id: e.identifier,
                        label: e.name,
                        type: 'provider',
                    };
                    nodes.push(node);
                }
                const edge = {
                    from: me.id,
                    to: e.identifier,
                    label: e.prefix,
                };
                edges.push(edge);
                queue.push(e.mantela);
            });
        } catch (e) {
            console.error(e)
        }
    }

    const container = document.getElementById('mandala');
    const data = {
        nodes: nodes,
        edges: edges,
    };
    const options = {
        edges: {
            arrows: 'to',
        },
    };

    // Vis.jsを使用してネットワークを描画
    const network = new vis.Network(container, data, options);
    // 選択されたノードとエッジの色を管理
    let highlightedNodes = [];
    let highlightedEdges = [];

    // ノードクリック時のイベントリスナーを追加
    network.on('click', function (params) {
        if (params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            const nodeData = nodes.find(node => node.id === nodeId);

            if (!nodeData) return;

            // スタートノード（providers）を選択
            if (nodeData.type === 'provider') {
                resetHighlight();
                // 既存のスタートノードを上書き可能に
                startNodeId = nodeId;
                //alert(`スタートノードを設定しました: ${nodeData.label}`);

                // 選択したノードがスタートノードとして再設定された場合、ターゲットノードはリセット
                targetNodeId = null;
                const infoContainer = document.getElementById('node-info');
                infoContainer.innerHTML = `スタートノードが再設定されました。ターゲットノードを選択してください。`;
            }
            // ターゲットノード（extensions）を選択
            else if (nodeData.type === 'extension' && startNodeId) {
                targetNodeId = nodeId; // 常に最新のターゲットノードを設定
                //alert(`ターゲットノードを設定しました: ${nodeData.label}`);

                // 経路を検索して表示
                const path = findPath(startNodeId, targetNodeId);
                const infoContainer = document.getElementById('node-info');
                if (path) {
                    infoContainer.innerHTML = `
                        <strong>経路:</strong>
                        ${path.map((step, index) => {
                            if (step.edge) {
                                return `
                                    ${index === 0 ? '' : ' → '}
                                    <span>${step.node.label}</span>
                                    <span style="font-size: smaller; color: gray;">(${step.edge.label})</span>
                                `;
                            } else {
                                return `${index === 0 ? '' : ' → '}<span>${step.node.label}</span>`;
                            }
                        }).join('')} →
                        <span>${nodes.find(n => n.id === targetNodeId).label}</span>
                        <!--<p>
                            <strong>番号:</strong>
                            ${path.filter(step => step.edge).map(step => step.edge.label).join('')}
                        </p>-->
                    `;
                    highlightPath(path); // 経路をハイライト
                } else {
                    infoContainer.innerHTML = `スタートノードからターゲットノードへの経路が見つかりませんでした。`;
                }
            }
        } else {
            // ノード以外がクリックされた場合
            resetColor(); // 色をリセット
            const infoContainer = document.getElementById('node-info');
            infoContainer.innerHTML = `初期状態に戻りました。`;
            startNodeId = null;
            targetNodeId = null;
        }
    });

    /**
     * スタートノードからターゲットノードまでの経路を見つける関数
     * @param {string} start - スタートノードID
     * @param {string} target - ターゲットノードID
     * @returns {Array|null} 経路情報（ノードとエッジの順序付きリスト）
     */
    function findPath(start, target) {
        const visited = new Set();
        const queue = [{ node: start, path: [], providerCount: 0 }]; // providerCountを追加

        while (queue.length > 0) {
            const { node, path, providerCount } = queue.shift();

            // 訪問済みのノードをスキップ
            if (visited.has(node)) continue;

            // 現在のノードを訪問済みとして追加
            visited.add(node);

            // ターゲットノードに到達した場合、経路を返す
            if (node === target) {
                return path;
            }

            // 現在のノードのデータを取得
            const currentNodeData = nodes.find(n => n.id === node);
            if (!currentNodeData) continue;

            // `provider` ノードを2回以上通過しないようにする
            const isProvider = currentNodeData.type === 'provider';
            if (isProvider && providerCount >= 2) {
                continue;
            }

            // 接続されているエッジを取得
            const connectedEdges = edges.filter(edge => edge.from === node);

            // キューに次のノードを追加
            connectedEdges.forEach(edge => {
                queue.push({
                    node: edge.to,
                    path: [...path, { node: currentNodeData, edge }],
                    providerCount: isProvider ? providerCount + 1 : providerCount, // providerCountを更新
                });
            });
        }

        return null; // 経路が見つからなかった場合
    }
    /**
     * 経路をハイライトする関数
     * @param {Array} path - 経路情報（ノードとエッジの順序付きリスト）
     */
    function highlightPath(path) {
        resetHighlight();
        const nodeIds = path.map(step => step.node.id);
        const edgeIds = path.filter(step => step.edge).map(step => step.edge.id);

        // ノードをハイライト
        nodeIds.forEach(nodeId => {
            const node = network.body.data.nodes.get(nodeId);
            if (node) {
                network.body.data.nodes.update({
                    id: nodeId,
                    color: { background: 'red', border: 'darkred' } // ハイライトカラー
                });
            }
        });

        // エッジをハイライト
        edgeIds.forEach(edgeId => {
            const edge = network.body.data.edges.get(edgeId);
            if (edge) {
                network.body.data.edges.update({
                    id: edgeId,
                    color: { color: 'blue', highlight: 'darkblue' } // ハイライトカラー
                });
            }
        });
    }

    /**
     * ハイライトをリセットする関数
     */
    function resetHighlight() {
        // すべてのノードの色をデフォルトに戻す
        const allNodes = network.body.data.nodes.get();
        allNodes.forEach(node => {
            network.body.data.nodes.update({
                id: node.id,
                color: { background: 'lightgray', border: 'gray' } // デフォルトカラー
            });
        });

        // すべてのエッジの色をデフォルトに戻す
        const allEdges = network.body.data.edges.get();
        allEdges.forEach(edge => {
            network.body.data.edges.update({
                id: edge.id,
                color: { color: 'lightgray', highlight: 'gray' } // デフォルトカラー
            });
        });
    }

    /**
     * 初期状態の色に戻す関数
     */
    function resetColor() {
        // 全ノードの色を初期状態に戻す
        const allNodes = network.body.data.nodes.get();
        allNodes.forEach(node => {
            if (node.type === 'extension') {
                network.body.data.nodes.update({
                    id: node.id,
                    color: { background: 'orange', border: 'darkorange' } // 初期の拡張ノードの色
                });
            } else if (node.type === 'provider') {
                network.body.data.nodes.update({
                    id: node.id,
                    color: { background: '#97C2FC', border: '#2B7CE9' } // 初期のプロバイダノードの色
                });
            }
        });

        // 全エッジの色を初期状態（ライトグレー）に戻す
        const allEdges = network.body.data.edges.get();
        allEdges.forEach(edge => {
            network.body.data.edges.update({
                id: edge.id,
                color: { background: '#97C2FC', border: '#2B7CE9' } // 初期のエッジの色
            });
        });
    }
}

const q = (new URLSearchParams(document.location.search)).get('first');
if (q) {
    first.value = q;
    main(first.value);
}
