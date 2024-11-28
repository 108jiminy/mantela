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

    // ノードクリック時のイベントリスナーを追加
    network.on('click', function (params) {
        if (params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            const nodeData = nodes.find(node => node.id === nodeId);

            if (!nodeData) return;

            // スタートノード（providers）を選択
            if (nodeData.type === 'provider') {
                // 既存のスタートノードを上書き可能に
                startNodeId = nodeId;
                //alert(`スタートノードを設定しました: ${nodeData.label}`);

                // 選択したノードがスタートノードとして再設定された場合、ターゲットノードはリセット
                targetNodeId = null;
                const infoContainer = document.getElementById('node-info');
                infoContainer.innerHTML = `<p>スタートノードが再設定されました。ターゲットノードを選択してください。</p>`;
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
                        <h3>経路情報</h3>
                        <p><strong>スタートノード:</strong> ${nodes.find(n => n.id === startNodeId).label}</p>
                        <p><strong>ターゲットノード:</strong> ${nodes.find(n => n.id === targetNodeId).label}</p>
                        <ul>
                            ${path.map(step => `
                                <li>
                                    <strong>ノード:</strong> ${step.node.label} <br>
                                    ${step.edge ? `<strong>矢印ラベル:</strong> ${step.edge.label}` : ''}
                                </li>
                            `).join('')}
                        </ul>
                    `;
                } else {
                    infoContainer.innerHTML = `<p>スタートノードからターゲットノードへの経路が見つかりませんでした。</p>`;
                }
            }
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
}

const q = (new URLSearchParams(document.location.search)).get('first');
if (q) {
    first.value = q;
    main(first.value);
}
