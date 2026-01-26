CREATE TABLE users (
                       id UUID PRIMARY KEY,
                       username TEXT NOT NULL UNIQUE,
                       email TEXT NOT NULL UNIQUE,
                       password_hash TEXT NOT NULL,
                       referrer_id UUID NULL,
                       created_at TIMESTAMP NOT NULL,

                       CONSTRAINT fk_referrer
                           FOREIGN KEY (referrer_id)
                               REFERENCES users(id)
);
