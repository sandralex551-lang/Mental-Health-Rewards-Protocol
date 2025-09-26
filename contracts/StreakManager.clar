(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-USER u101)
(define-constant ERR-INVALID-ACTIVITY-TYPE u102)
(define-constant ERR-INVALID-STREAK-LENGTH u103)
(define-constant ERR-INVALID-MULTIPLIER u104)
(define-constant ERR-INVALID-TIMESTAMP u105)
(define-constant ERR-STREAK-ALREADY-EXISTS u106)
(define-constant ERR-STREAK-NOT-FOUND u107)
(define-constant ERR-INVALID-RESET-REASON u108)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u109)
(define-constant ERR-INVALID-MIN-STREAK u110)
(define-constant ERR-INVALID-MAX-STREAK u111)
(define-constant ERR-STREAK-UPDATE-NOT-ALLOWED u112)
(define-constant ERR-INVALID-UPDATE-PARAM u113)
(define-constant ERR-MAX-ACTIVITIES-EXCEEDED u114)
(define-constant ERR-INVALID-ACTIVITY-DURATION u115)
(define-constant ERR-INVALID-REWARD-THRESHOLD u116)
(define-constant ERR-INVALID-GRACE-PERIOD u117)
(define-constant ERR-INVALID-LOCATION u118)
(define-constant ERR-INVALID-PROOF-HASH u119)
(define-constant ERR-INVALID-STATUS u120)

(define-data-var next-streak-id uint u0)
(define-data-var max-activities uint u100)
(define-data-var update-fee uint u100)
(define-data-var authority-contract (optional principal) none)

(define-map streaks
  { user: principal, activity-type: (string-utf8 50) }
  {
    current-length: uint,
    max-length: uint,
    last-timestamp: uint,
    multiplier: uint,
    timestamp: uint,
    status: bool,
    min-streak: uint,
    max-streak: uint,
    reward-threshold: uint,
    grace-period: uint,
    proof-hash: (buff 32)
  }
)

(define-map streaks-by-user
  principal
  (list 100 { activity-type: (string-utf8 50), streak-id: uint })
)

(define-map streak-updates
  { user: principal, activity-type: (string-utf8 50) }
  {
    update-length: uint,
    update-multiplier: uint,
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-streak (user principal) (activity-type (string-utf8 50)))
  (map-get? streaks { user: user, activity-type: activity-type })
)

(define-read-only (get-streak-updates (user principal) (activity-type (string-utf8 50)))
  (map-get? streak-updates { user: user, activity-type: activity-type })
)

(define-read-only (is-streak-active (user principal) (activity-type (string-utf8 50)))
  (match (map-get? streaks { user: user, activity-type: activity-type })
    s (get status s)
    false
  )
)

(define-private (validate-user (user principal))
  (if (not (is-eq user tx-sender))
      (err ERR-NOT-AUTHORIZED)
      (ok true))
)

(define-private (validate-activity-type (type (string-utf8 50)))
  (if (and (> (len type) u0) (<= (len type) u50))
      (ok true)
      (err ERR-INVALID-ACTIVITY-TYPE))
)

(define-private (validate-streak-length (length uint))
  (if (> length u0)
      (ok true)
      (err ERR-INVALID-STREAK-LENGTH))
)

(define-private (validate-multiplier (multiplier uint))
  (if (and (>= multiplier u1) (<= multiplier u10))
      (ok true)
      (err ERR-INVALID-MULTIPLIER))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-min-streak (min uint))
  (if (>= min u1)
      (ok true)
      (err ERR-INVALID-MIN-STREAK))
)

(define-private (validate-max-streak (max uint))
  (if (> max u0)
      (ok true)
      (err ERR-INVALID-MAX-STREAK))
)

(define-private (validate-reward-threshold (threshold uint))
  (if (>= threshold u1)
      (ok true)
      (err ERR-INVALID-REWARD-THRESHOLD))
)

(define-private (validate-grace-period (period uint))
  (if (<= period u7)
      (ok true)
      (err ERR-INVALID-GRACE-PERIOD))
)

(define-private (validate-proof-hash (hash (buff 32)))
  (if (is-eq (len hash) u32)
      (ok true)
      (err ERR-INVALID-PROOF-HASH))
)

(define-private (calculate-multiplier (length uint))
  (if (>= length u30)
      u5
      (if (>= length u14)
          u3
          (if (>= length u7)
              u2
              u1)))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-activities (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-activities new-max)
    (ok true)
  )
)

(define-public (set-update-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set update-fee new-fee)
    (ok true)
  )
)

(define-public (start-streak
  (activity-type (string-utf8 50))
  (min-streak uint)
  (max-streak uint)
  (reward-threshold uint)
  (grace-period uint)
  (proof-hash (buff 32))
)
  (let (
        (user tx-sender)
        (key { user: user, activity-type: activity-type })
        (user-activities (default-to (list ) (map-get? streaks-by-user user)))
        (authority (var-get authority-contract))
      )
    (try! (validate-activity-type activity-type))
    (try! (validate-min-streak min-streak))
    (try! (validate-max-streak max-streak))
    (try! (validate-reward-threshold reward-threshold))
    (try! (validate-grace-period grace-period))
    (try! (validate-proof-hash proof-hash))
    (asserts! (is-none (map-get? streaks key)) (err ERR-STREAK-ALREADY-EXISTS))
    (asserts! (< (len user-activities) (var-get max-activities)) (err ERR-MAX-ACTIVITIES-EXCEEDED))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get update-fee) tx-sender authority-recipient))
    )
    (map-set streaks key
      {
        current-length: u1,
        max-length: u1,
        last-timestamp: block-height,
        multiplier: u1,
        timestamp: block-height,
        status: true,
        min-streak: min-streak,
        max-streak: max-streak,
        reward-threshold: reward-threshold,
        grace-period: grace-period,
        proof-hash: proof-hash
      }
    )
    (map-set streaks-by-user user (append user-activities { activity-type: activity-type, streak-id: (var-get next-streak-id) }))
    (var-set next-streak-id (+ (var-get next-streak-id) u1))
    (print { event: "streak-started", user: user, activity-type: activity-type })
    (ok true)
  )
)

(define-public (update-streak
  (activity-type (string-utf8 50))
  (proof-hash (buff 32))
)
  (let (
        (user tx-sender)
        (key { user: user, activity-type: activity-type })
        (streak (map-get? streaks key))
      )
    (match streak
      s
        (begin
          (try! (validate-user user))
          (try! (validate-proof-hash proof-hash))
          (asserts! (get status s) (err ERR-INVALID-STATUS))
          (let (
                (last-ts (get last-timestamp s))
                (current-ts block-height)
                (grace (get grace-period s))
                (diff (- current-ts last-ts))
                (new-length (if (<= diff (+ u1 grace))
                                (+ (get current-length s) u1)
                                u1))
                (new-max (if (> new-length (get max-length s))
                             new-length
                             (get max-length s)))
                (new-multiplier (calculate-multiplier new-length))
              )
            (map-set streaks key
              (merge s {
                current-length: new-length,
                max-length: new-max,
                last-timestamp: current-ts,
                multiplier: new-multiplier,
                timestamp: current-ts
              })
            )
            (map-set streak-updates key
              {
                update-length: new-length,
                update-multiplier: new-multiplier,
                update-timestamp: current-ts,
                updater: user
              }
            )
            (print { event: "streak-updated", user: user, activity-type: activity-type, length: new-length })
            (ok new-length)
          )
        )
      (err ERR-STREAK-NOT-FOUND)
    )
  )
)

(define-public (reset-streak
  (activity-type (string-utf8 50))
  (reason (string-utf8 100))
)
  (let (
        (user tx-sender)
        (key { user: user, activity-type: activity-type })
        (streak (map-get? streaks key))
      )
    (match streak
      s
        (begin
          (try! (validate-user user))
          (asserts! (> (len reason) u0) (err ERR-INVALID-RESET-REASON))
          (map-set streaks key
            (merge s {
              current-length: u0,
              status: false,
              timestamp: block-height
            })
          )
          (print { event: "streak-reset", user: user, activity-type: activity-type, reason: reason })
          (ok true)
        )
      (err ERR-STREAK-NOT-FOUND)
    )
  )
)

(define-public (get-user-activity-count (user principal))
  (ok (len (default-to (list ) (map-get? streaks-by-user user))))
)