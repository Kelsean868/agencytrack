import json, collections
from pathlib import Path

g = json.loads(Path("graphify-out/graph.json").read_text(encoding="utf-8"))
nodes = g["nodes"]
links = g["links"]
print(f"Total nodes: {len(nodes)}")
print(f"Total links: {len(links)}")

by_label = collections.Counter(n["label"] for n in nodes)
dupes = [(label, cnt) for label, cnt in by_label.items() if cnt > 1]
dupes.sort(key=lambda x: -x[1])
print(f"\nNames appearing >1 time: {len(dupes)}")
print("Top 10 duplicated names:")
for label, cnt in dupes[:10]:
    print(f"  {cnt}x  {repr(label)}")

top_label = dupes[0][0] if dupes else None
if top_label:
    print(f"\nFull node objects for {repr(top_label)}:")
    for n in nodes:
        if n["label"] == top_label:
            print(json.dumps({k: n.get(k) for k in ("id","label","file_type","source_file")}, indent=2))

by_type = collections.Counter(n.get("file_type","?") for n in nodes)
print("\nNode breakdown by file_type:")
for ft, cnt in by_type.most_common():
    print(f"  {cnt:6d}  {ft}")

# Also check id uniqueness
by_id = collections.Counter(n["id"] for n in nodes)
id_dupes = [(nid, cnt) for nid, cnt in by_id.items() if cnt > 1]
print(f"\nIDs appearing >1 time: {len(id_dupes)}")
if id_dupes:
    id_dupes.sort(key=lambda x: -x[1])
    for nid, cnt in id_dupes[:5]:
        print(f"  {cnt}x  {nid}")
