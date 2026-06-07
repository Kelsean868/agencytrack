import json, collections
from pathlib import Path
g = json.loads(Path("graphify-out/graph.json").read_text(encoding="utf-8"))
nodes = g["nodes"]
# Count occurrence of target labels globally
target_labels = ["violations", "byRule", "impact", "nodes"]
label_counts = collections.Counter(n.get("label","") for n in nodes)
for lbl in target_labels:
    print(f"  {lbl}: {label_counts.get(lbl, 0)} occurrences")
print(f"Total nodes: {len(nodes)}, edges: {len(g['links'])}")
# file_type breakdown
type_counts = collections.Counter(n.get("file_type","?") for n in nodes)
for k,v in type_counts.most_common():
    print(f"  file_type={k}: {v}")
