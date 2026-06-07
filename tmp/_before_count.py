import json
from pathlib import Path
g = json.loads(Path("graphify-out/graph.json").read_text(encoding="utf-8"))
nodes = len(g["nodes"])
links = len(g["links"])
print(f"BEFORE -- nodes: {nodes}, edges: {links}")
