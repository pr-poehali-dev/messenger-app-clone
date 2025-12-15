import json
import os
import psycopg2
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Авторизация пользователя по username
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    if method == 'POST':
        body_data = json.loads(event.get('body', '{}'))
        username = body_data.get('username', '').strip()
        
        if not username:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Username is required'}),
                'isBase64Encoded': False
            }
        
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        
        cur.execute("SELECT id, username, display_name, avatar_url, bio FROM users WHERE username = %s", (username,))
        user = cur.fetchone()
        
        if user:
            user_data = {
                'id': user[0],
                'username': user[1],
                'display_name': user[2],
                'avatar_url': user[3],
                'bio': user[4]
            }
        else:
            cur.execute(
                "INSERT INTO users (username, display_name) VALUES (%s, %s) RETURNING id, username, display_name, avatar_url, bio",
                (username, username)
            )
            conn.commit()
            user = cur.fetchone()
            user_data = {
                'id': user[0],
                'username': user[1],
                'display_name': user[2],
                'avatar_url': user[3],
                'bio': user[4]
            }
        
        cur.execute("UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = %s", (user_data['id'],))
        conn.commit()
        
        cur.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'user': user_data}),
            'isBase64Encoded': False
        }
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'}),
        'isBase64Encoded': False
    }
