-- Add calls table for signaling
CREATE TABLE IF NOT EXISTS t_p75418884_messenger_app_clone.calls (
    id SERIAL PRIMARY KEY,
    caller_id INTEGER NOT NULL REFERENCES t_p75418884_messenger_app_clone.users(id),
    receiver_id INTEGER NOT NULL REFERENCES t_p75418884_messenger_app_clone.users(id),
    call_type VARCHAR(10) NOT NULL CHECK (call_type IN ('audio', 'video')),
    status VARCHAR(20) NOT NULL DEFAULT 'calling' CHECK (status IN ('calling', 'accepted', 'rejected', 'ended', 'missed')),
    signal_data TEXT,
    answer_signal TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_calls_receiver ON t_p75418884_messenger_app_clone.calls(receiver_id, status);
CREATE INDEX idx_calls_caller ON t_p75418884_messenger_app_clone.calls(caller_id, status);