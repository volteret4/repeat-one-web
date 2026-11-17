# Fuera los usuarios de Telegram de otras personas y los chat_id.
f = out / map['api/users']
f.write_text(json.dumps([{'id': u['id'], 'username': u['username']} for u in json.loads(f.read_text()) if u['id'] == 9], ensure_ascii=False))
for k in [k for k in map if k.startswith('api/user/') and not k.startswith('api/user/9/')]:
    (out / map[k]).unlink(); del map[k]
