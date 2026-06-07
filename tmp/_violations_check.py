import json
from pathlib import Path
g = json.loads(Path("graphify-out/graph.json").read_text(encoding="utf-8"))
remaining = [n for n in g["nodes"] if n.get("label","") == "violations"]
for n in remaining:
    print(json.dumps({k: n.get(k,"") for k in ["id","label","path","file_type"]}, indent=2))
