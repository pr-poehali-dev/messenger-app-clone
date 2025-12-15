import json
import os
import time
import hmac
import hashlib
import base64
from typing import Dict, Any

def generate_rtc_token(app_id: str, app_certificate: str, channel_name: str, uid: int, expiration_time: int = 3600):
    """
    Генерация Agora RTC токена
    """
    current_timestamp = int(time.time())
    privilege_expired_ts = current_timestamp + expiration_time
    
    msg = app_id + channel_name + str(uid) + str(privilege_expired_ts)
    signature = hmac.new(
        app_certificate.encode('utf-8'),
        msg.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    token_data = {
        'signature': signature,
        'app_id': app_id,
        'channel_name': channel_name,
        'uid': uid,
        'ts': privilege_expired_ts
    }
    
    token_json = json.dumps(token_data)
    token = base64.b64encode(token_json.encode('utf-8')).decode('utf-8')
    
    return token

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Генерация Agora токена для видео/аудио звонков
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
        channel_name = body_data.get('channelName')
        uid = body_data.get('uid', 0)
        
        if not channel_name:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'channelName required'}),
                'isBase64Encoded': False
            }
        
        app_id = os.environ.get('AGORA_APP_ID', '')
        app_certificate = os.environ.get('AGORA_APP_CERTIFICATE', '')
        
        if not app_id or not app_certificate:
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Agora credentials not configured'}),
                'isBase64Encoded': False
            }
        
        token = generate_rtc_token(app_id, app_certificate, channel_name, uid)
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'token': token,
                'appId': app_id,
                'channelName': channel_name,
                'uid': uid
            }),
            'isBase64Encoded': False
        }
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'}),
        'isBase64Encoded': False
    }
