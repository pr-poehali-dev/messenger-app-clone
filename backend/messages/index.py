import json
import os
import psycopg2
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Получение и отправка сообщений
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
    
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    
    if method == 'GET':
        params = event.get('queryStringParameters', {})
        user1_id = params.get('user1Id')
        user2_id = params.get('user2Id')
        
        if not user1_id or not user2_id:
            cur.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Both user IDs are required'}),
                'isBase64Encoded': False
            }
        
        cur.execute(
            """
            SELECT id FROM chats 
            WHERE (user1_id = %s AND user2_id = %s) OR (user1_id = %s AND user2_id = %s)
            """,
            (user1_id, user2_id, user2_id, user1_id)
        )
        chat = cur.fetchone()
        
        if not chat:
            cur.execute(
                "INSERT INTO chats (user1_id, user2_id) VALUES (%s, %s) RETURNING id",
                (min(int(user1_id), int(user2_id)), max(int(user1_id), int(user2_id)))
            )
            conn.commit()
            chat = cur.fetchone()
        
        chat_id = chat[0]
        
        cur.execute(
            """
            SELECT m.id, m.content, m.sender_id, m.created_at, m.is_read
            FROM messages m
            WHERE m.chat_id = %s
            ORDER BY m.created_at ASC
            """,
            (chat_id,)
        )
        messages = cur.fetchall()
        
        result = [
            {
                'id': msg[0],
                'content': msg[1],
                'senderId': msg[2],
                'createdAt': msg[3].isoformat() if msg[3] else None,
                'isRead': msg[4]
            }
            for msg in messages
        ]
        
        cur.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'chatId': chat_id, 'messages': result}),
            'isBase64Encoded': False
        }
    
    if method == 'POST':
        body_data = json.loads(event.get('body', '{}'))
        chat_id = body_data.get('chatId')
        sender_id = body_data.get('senderId')
        content = body_data.get('content', '').strip()
        
        if not chat_id or not sender_id or not content:
            cur.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Chat ID, sender ID, and content are required'}),
                'isBase64Encoded': False
            }
        
        cur.execute(
            "INSERT INTO messages (chat_id, sender_id, content) VALUES (%s, %s, %s) RETURNING id, content, sender_id, created_at, is_read",
            (chat_id, sender_id, content)
        )
        conn.commit()
        message = cur.fetchone()
        
        result = {
            'id': message[0],
            'content': message[1],
            'senderId': message[2],
            'createdAt': message[3].isoformat() if message[3] else None,
            'isRead': message[4]
        }
        
        cur.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'message': result}),
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
