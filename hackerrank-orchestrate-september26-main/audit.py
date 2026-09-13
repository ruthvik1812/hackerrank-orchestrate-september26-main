import csv

with open('dataset/sample_requests.csv') as f:
    rows = list(csv.DictReader(f))
print(f'Sample requests: {len(rows)}')
statuses = {}
methods = {}
for r in rows:
    s = r['affordability_status']
    m = r['recommended_payment_method']
    statuses[s] = statuses.get(s,0)+1
    methods[m] = methods.get(m,0)+1
print('Ground truth statuses:', statuses)
print('Ground truth methods:', methods)
for r in rows[:5]:
    print(r['request_id'], r['affordability_status'], r['recommended_payment_method'], r['payment_plan'][:50])
