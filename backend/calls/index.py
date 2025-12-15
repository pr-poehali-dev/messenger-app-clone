import json
import os
import psycopg2
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Управление видео и аудио звонками между пользователями
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    
    if method == 'POST':
        body_data = json.loads(event.get('body', '{}'))
        caller_id = body_data.get('callerId')
        receiver_id = body_data.get('receiverId')
        call_type = body_data.get('callType', 'audio')
        signal_data = body_data.get('signalData')
        
        if not caller_id or not receiver_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'callerId and receiverId required'}),
                'isBase64Encoded': False
            }
        
        cur.execute(
            "INSERT INTO t_p75418884_messenger_app_clone.calls (caller_id, receiver_id, call_type, signal_data, status) VALUES (%s, %s, %s, %s, 'calling') RETURNING id",
            (caller_id, receiver_id, call_type, json.dumps(signal_data))
        )
        call_id = cur.fetchone()[0]
        conn.commit()
        
        cur.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'callId': call_id}),
            'isBase64Encoded': False
        }
    
    if method == 'GET':
        params = event.get('queryStringParameters', {})
        user_id = params.get('userId')
        
        if not user_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'userId required'}),
                'isBase64Encoded': False
            }
        
        cur.execute(
            """
            SELECT c.id, c.caller_id, c.receiver_id, c.call_type, c.signal_data, c.answer_signal, c.status,
                   u.username, u.display_name, u.avatar_url
            FROM t_p75418884_messenger_app_clone.calls c
            JOIN t_p75418884_messenger_app_clone.users u ON u.id = c.caller_id
            WHERE c.receiver_id = %s AND c.status = 'calling'
            ORDER BY c.created_at DESC
            LIMIT 1
            """,
            (user_id,)
        )
        
        call = cur.fetchone()
        
        if call:
            call_data = {
                'id': call[0],
                'callerId': call[1],
                'receiverId': call[2],
                'callType': call[3],
                'signalData': json.loads(call[4]) if call[4] else None,
                'answerSignal': json.loads(call[5]) if call[5] else None,
                'status': call[6],
                'callerUsername': call[7],
                'callerDisplayName': call[8],
                'callerAvatar': call[9]
            }
            
            cur.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'call': call_data}),
                'isBase64Encoded': False
            }
        
        cur.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'call': None}),
            'isBase64Encoded': False
        }
    
    if method == 'PUT':
        body_data = json.loads(event.get('body', '{}'))
        call_id = body_data.get('callId')
        status = body_data.get('status')
        answer_signal = body_data.get('answerSignal')
        
        if not call_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'callId required'}),
                'isBase64Encoded': False
            }
        
        if status:
            cur.execute(
                "UPDATE t_p75418884_messenger_app_clone.calls SET status = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                (status, call_id)
            )
        
        if answer_signal:
            cur.execute(
                "UPDATE t_p75418884_messenger_app_clone.calls SET answer_signal = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                (json.dumps(answer_signal), call_id)
            )
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'success': True}),
            'isBase64Encoded': False
        }
    
    if method == 'DELETE':
        params = event.get('queryStringParameters', {})
        call_id = params.get('callId')
        
        if call_id:
            cur.execute(
                "UPDATE t_p75418884_messenger_app_clone.calls SET status = 'ended', updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                (call_id,)
            )
            conn.commit()
        
        cur.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'success': True}),
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
