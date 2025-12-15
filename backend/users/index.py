import json
import os
import psycopg2
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Управление профилем пользователя и поиск
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    
    if method == 'GET':
        params = event.get('queryStringParameters', {})
        search_query = params.get('search', '').strip()
        user_id = params.get('userId')
        
        if user_id:
            cur.execute(
                "SELECT id, username, display_name, avatar_url, bio, last_seen FROM users WHERE id = %s",
                (user_id,)
            )
            user = cur.fetchone()
            if user:
                result = {
                    'id': user[0],
                    'username': user[1],
                    'display_name': user[2],
                    'avatar_url': user[3],
                    'bio': user[4],
                    'last_seen': user[5].isoformat() if user[5] else None
                }
            else:
                result = None
        elif search_query:
            cur.execute(
                "SELECT id, username, display_name, avatar_url FROM users WHERE username ILIKE %s OR display_name ILIKE %s LIMIT 20",
                (f'%{search_query}%', f'%{search_query}%')
            )
            users = cur.fetchall()
            result = [
                {
                    'id': user[0],
                    'username': user[1],
                    'display_name': user[2],
                    'avatar_url': user[3]
                }
                for user in users
            ]
        else:
            result = []
        
        cur.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'data': result}),
            'isBase64Encoded': False
        }
    
    if method == 'PUT':
        body_data = json.loads(event.get('body', '{}'))
        user_id = body_data.get('userId')
        display_name = body_data.get('displayName')
        bio = body_data.get('bio')
        avatar_url = body_data.get('avatarUrl')
        
        if not user_id:
            cur.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'User ID is required'}),
                'isBase64Encoded': False
            }
        
        updates = []
        params = []
        
        if display_name is not None:
            updates.append("display_name = %s")
            params.append(display_name)
        if bio is not None:
            updates.append("bio = %s")
            params.append(bio)
        if avatar_url is not None:
            updates.append("avatar_url = %s")
            params.append(avatar_url)
        
        if updates:
            params.append(user_id)
            query = f"UPDATE users SET {', '.join(updates)} WHERE id = %s RETURNING id, username, display_name, avatar_url, bio"
            cur.execute(query, params)
            conn.commit()
            user = cur.fetchone()
            
            result = {
                'id': user[0],
                'username': user[1],
                'display_name': user[2],
                'avatar_url': user[3],
                'bio': user[4]
            }
        else:
            result = None
        
        cur.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'user': result}),
            'isBase64Encoded': False
        }
    
    cur.close()
    conn.close()
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'}),
        'isBase64Encoded': False
    }
