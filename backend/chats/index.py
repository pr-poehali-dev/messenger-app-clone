import json
import os
import psycopg2
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Получение списка чатов пользователя
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    if method == 'GET':
        params = event.get('queryStringParameters', {})
        user_id = params.get('userId')
        
        if not user_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'User ID is required'}),
                'isBase64Encoded': False
            }
        
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        
        cur.execute(
            """
            SELECT 
                c.id,
                CASE 
                    WHEN c.user1_id = %s THEN u2.id
                    ELSE u1.id
                END as other_user_id,
                CASE 
                    WHEN c.user1_id = %s THEN u2.username
                    ELSE u1.username
                END as other_username,
                CASE 
                    WHEN c.user1_id = %s THEN u2.display_name
                    ELSE u1.display_name
                END as other_display_name,
                CASE 
                    WHEN c.user1_id = %s THEN u2.avatar_url
                    ELSE u1.avatar_url
                END as other_avatar,
                CASE 
                    WHEN c.user1_id = %s THEN u2.last_seen
                    ELSE u1.last_seen
                END as other_last_seen,
                (SELECT m.content FROM messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
                (SELECT m.created_at FROM messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_time,
                (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id AND m.sender_id != %s AND m.is_read = false) as unread_count
            FROM chats c
            JOIN users u1 ON c.user1_id = u1.id
            JOIN users u2 ON c.user2_id = u2.id
            WHERE c.user1_id = %s OR c.user2_id = %s
            ORDER BY last_message_time DESC NULLS LAST
            """,
            (user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id)
        )
        chats = cur.fetchall()
        
        result = [
            {
                'chatId': chat[0],
                'userId': chat[1],
                'username': chat[2],
                'displayName': chat[3],
                'avatarUrl': chat[4],
                'lastSeen': chat[5].isoformat() if chat[5] else None,
                'lastMessage': chat[6],
                'lastMessageTime': chat[7].isoformat() if chat[7] else None,
                'unreadCount': chat[8]
            }
            for chat in chats
        ]
        
        cur.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'chats': result}),
            'isBase64Encoded': False
        }
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'}),
        'isBase64Encoded': False
    }
