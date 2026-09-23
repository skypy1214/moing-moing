update coupons coupon
set name = concat(
        extract(year from award.target_month)::integer,
        '년 ',
        extract(month from award.target_month)::integer,
        '월 출석왕 쿠폰'
    ),
    issued_reason = concat(
        extract(year from award.target_month)::integer,
        '년 ',
        extract(month from award.target_month)::integer,
        '월 출석왕 자동 발급'
    ),
    updated_at = now()
from attendance_champion_awards award
where coupon.champion_award_id = award.id
  and coupon.coupon_type = 'ATTENDANCE_CHAMPION';
