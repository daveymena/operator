import json, collections
d = json.load(open('ordenes_procesadas.json'))
c = collections.Counter(o.get('status') for o in d)
print(dict(c))
for o in d:
    if o.get('status') == 'pending':
        print(f"  OT {o['ot']} | {o['ciudad']} | Mat:{o.get('aplicaMaterial','?')}")
