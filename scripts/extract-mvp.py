import json
import openpyxl

wb = openpyxl.load_workbook(
    r'C:\Users\rushil.kaul\Downloads\moglix_freshservice_index.xlsx',
    read_only=True,
    data_only=True,
)
ws = wb['00_MASTER_INDEX']
rows = list(ws.iter_rows(values_only=True))
hdr_idx = next(i for i, row in enumerate(rows) if row and row[0] == 'ID')
hdr = rows[hdr_idx]

mvp_items = []
for row in rows[hdr_idx + 1 :]:
    if not row or not row[0] or not str(row[0]).startswith('MFI-'):
        continue
    in_mvp = str(row[2] or '').strip().upper() == 'YES'
    if in_mvp:
        mvp_items.append(
            {
                'id': row[0],
                'phase': row[1],
                'module': row[3],
                'submodule': row[4],
                'priority': row[5],
                'feature': row[6],
                'what': row[7],
            }
        )

print(json.dumps(mvp_items, indent=2))
print('TOTAL', len(mvp_items))
wb.close()
