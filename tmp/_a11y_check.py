import json
from pathlib import Path
g = json.loads(Path("graphify-out/graph.json").read_text(encoding="utf-8"))
nodes = g["nodes"]
# Find any nodes whose path contains verification/a11y
a11y_nodes = [n for n in nodes if "verification/a11y" in n.get("path", "") or "verification\\\\a11y" in n.get("path", "") or "verification\\a11y" in n.get("path", "")]
print(f"a11y nodes still in graph: {len(a11y_nodes)}")
if a11y_nodes:
    print("Sample IDs:")
    for n in a11y_nodes[:5]:
        print(f"  id={n.get('id','?')}, path={n.get('path','?')[:80]}")
