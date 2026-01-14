#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
베트맨(Betman) & 라이브스코어(Livescore) 통합 크롤링 스크립트
Supabase 연동 및 자동 데이터 매칭
"""

import os
import time
import random
import logging
from datetime import datetime
from typing import List, Dict, Optional
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright, Page, Browser
from playwright_stealth import stealth_sync
from fuzzywuzzy import fuzz
from supabase import create_client, Client

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('scraper.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# 환경 변수 로드
load_dotenv('.env.local')

# Supabase 클라이언트 초기화
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Supabase 환경 변수가 설정되지 않았습니다. .env.local 파일을 확인하세요.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
logger.info("✅ Supabase 클라이언트 초기화 완료")

# 설정
HEADLESS = False  # 테스트용: False로 설정하면 브라우저가 보임
BETMAN_URL = "https://www.betman.co.kr/main.do"
LIVESCORE_URL = "https://www.livescore.co.kr/"


def random_sleep(min_sec: float = 1.0, max_sec: float = 3.0):
    """사람처럼 보이기 위한 랜덤 대기"""
    time.sleep(random.uniform(min_sec, max_sec))


def normalize_team_name(name: str) -> str:
    """팀 이름 정규화"""
    if not name:
        return ""
    # 공백 제거, 소문자 변환
    return name.strip().lower().replace(" ", "")


def match_team_names(name1: str, name2: str, threshold: int = 80) -> bool:
    """팀 이름 유사도 매칭 (fuzzywuzzy)"""
    norm1 = normalize_team_name(name1)
    norm2 = normalize_team_name(name2)
    
    # 정확히 일치
    if norm1 == norm2:
        return True
    
    # 유사도 계산
    ratio = fuzz.ratio(norm1, norm2)
    partial_ratio = fuzz.partial_ratio(norm1, norm2)
    
    return max(ratio, partial_ratio) >= threshold


def setup_browser(playwright) -> Browser:
    """Playwright 브라우저 설정 (Stealth 모드)"""
    browser = playwright.chromium.launch(
        headless=HEADLESS,
        args=[
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
            '--no-sandbox',
        ]
    )
    return browser


def scrape_betman(page: Page) -> List[Dict]:
    """베트맨 프로토 승부식 데이터 크롤링"""
    logger.info("🎰 베트맨 크롤링 시작...")
    matches = []
    
    try:
        # 베트맨 메인 페이지 접속
        page.goto(BETMAN_URL, wait_until='domcontentloaded', timeout=30000)
        random_sleep(2, 4)
        
        # Stealth 적용
        stealth_sync(page)
        
        # 프로토 승부식 페이지로 이동
        try:
            # 다양한 방법으로 프로토 승부식 링크 찾기
            proto_link = page.locator('a:has-text("프로토"), a:has-text("승부식")').first
            if proto_link.is_visible(timeout=5000):
                proto_link.click()
                random_sleep(3, 5)
            else:
                # 직접 URL 접근
                page.goto("https://www.betman.co.kr/sports/proto.do", timeout=30000)
                random_sleep(3, 5)
        except Exception as e:
            logger.warning(f"프로토 메뉴 클릭 실패, 직접 URL 접근 시도: {e}")
            page.goto("https://www.betman.co.kr/sports/proto.do", timeout=30000)
            random_sleep(3, 5)
        
        # iframe 확인 및 전환
        try:
            iframe = page.frame_locator('iframe[name="betman_frame"], iframe#content_iframe').first
            if iframe:
                logger.info("iframe 발견, 내부로 전환")
        except:
            iframe = None
            logger.info("iframe 없음, 메인 페이지에서 진행")
        
        # 경기 목록 추출 (다양한 셀렉터 시도)
        selectors = [
            '.game-list tr.game-row',
            '.match-list .match-item',
            'table.proto-list tbody tr',
            '.sports-list .match',
        ]
        
        for selector in selectors:
            try:
                if iframe:
                    elements = iframe.locator(selector).all()
                else:
                    elements = page.locator(selector).all()
                
                if elements and len(elements) > 0:
                    logger.info(f"✅ {len(elements)}개 경기 발견 (셀렉터: {selector})")
                    
                    for idx, element in enumerate(elements[:20]):  # 최대 20개
                        try:
                            # 경기 정보 추출 (구조는 실제 사이트에 따라 조정 필요)
                            time_text = element.locator('.game-time, .match-time, td:nth-child(1)').first.inner_text(timeout=1000)
                            sport = element.locator('.sport-type, .league-name, td:nth-child(2)').first.inner_text(timeout=1000)
                            home_team = element.locator('.home-team, .team-home, td:nth-child(3)').first.inner_text(timeout=1000)
                            away_team = element.locator('.away-team, .team-away, td:nth-child(4)').first.inner_text(timeout=1000)
                            
                            # 배당률 추출
                            odds_home = element.locator('.odds-home, .odds-1, td:nth-child(5)').first.inner_text(timeout=1000)
                            odds_draw = element.locator('.odds-draw, .odds-x, td:nth-child(6)').first.inner_text(timeout=1000)
                            odds_away = element.locator('.odds-away, .odds-2, td:nth-child(7)').first.inner_text(timeout=1000)
                            
                            match_data = {
                                'source': 'betman',
                                'match_time': time_text.strip(),
                                'sport': sport.strip(),
                                'home_team': home_team.strip(),
                                'away_team': away_team.strip(),
                                'odds_home': float(odds_home.strip()) if odds_home.strip().replace('.', '').isdigit() else None,
                                'odds_draw': float(odds_draw.strip()) if odds_draw.strip().replace('.', '').isdigit() else None,
                                'odds_away': float(odds_away.strip()) if odds_away.strip().replace('.', '').isdigit() else None,
                                'scraped_at': datetime.now().isoformat(),
                            }
                            
                            matches.append(match_data)
                            logger.info(f"  📋 {idx+1}. {home_team} vs {away_team}")
                            
                        except Exception as e:
                            logger.debug(f"  ⚠️ 경기 {idx+1} 파싱 실패: {e}")
                            continue
                    
                    break  # 성공하면 다른 셀렉터 시도 안 함
                    
            except Exception as e:
                logger.debug(f"셀렉터 {selector} 실패: {e}")
                continue
        
        if not matches:
            logger.warning("⚠️ 베트맨에서 경기를 찾지 못했습니다. 페이지 스크린샷 저장...")
            page.screenshot(path='betman_debug.png')
        
    except Exception as e:
        logger.error(f"❌ 베트맨 크롤링 오류: {e}")
        page.screenshot(path='betman_error.png')
    
    logger.info(f"✅ 베트맨 크롤링 완료: {len(matches)}개 경기")
    return matches


def scrape_livescore(page: Page) -> List[Dict]:
    """라이브스코어 경기 일정 및 결과 크롤링"""
    logger.info("⚽ 라이브스코어 크롤링 시작...")
    matches = []
    
    try:
        # 라이브스코어 접속
        page.goto(LIVESCORE_URL, wait_until='domcontentloaded', timeout=30000)
        random_sleep(2, 4)
        
        # Stealth 적용
        stealth_sync(page)
        
        # 경기 목록 추출 (다양한 셀렉터 시도)
        selectors = [
            '.match-row, .game-row',
            '.live-match, .fixture',
            'div[class*="match"]',
            'tr.match',
        ]
        
        for selector in selectors:
            try:
                elements = page.locator(selector).all()
                
                if elements and len(elements) > 0:
                    logger.info(f"✅ {len(elements)}개 경기 발견 (셀렉터: {selector})")
                    
                    for idx, element in enumerate(elements[:30]):  # 최대 30개
                        try:
                            # 경기 정보 추출
                            time_text = element.locator('.match-time, .time, [class*="time"]').first.inner_text(timeout=1000)
                            home_team = element.locator('.team-home, .home, [class*="home"]').first.inner_text(timeout=1000)
                            away_team = element.locator('.team-away, .away, [class*="away"]').first.inner_text(timeout=1000)
                            
                            # 점수 (있으면)
                            try:
                                score_text = element.locator('.score, [class*="score"]').first.inner_text(timeout=500)
                                home_score, away_score = score_text.split('-') if '-' in score_text else (None, None)
                            except:
                                home_score, away_score = None, None
                            
                            # 경기 상태
                            status = 'scheduled'
                            try:
                                status_text = element.locator('.status, [class*="status"]').first.inner_text(timeout=500)
                                if '종료' in status_text or 'FT' in status_text:
                                    status = 'finished'
                                elif '진행' in status_text or 'LIVE' in status_text:
                                    status = 'live'
                            except:
                                if home_score and away_score:
                                    status = 'finished'
                            
                            match_data = {
                                'source': 'livescore',
                                'match_time': time_text.strip(),
                                'home_team': home_team.strip(),
                                'away_team': away_team.strip(),
                                'home_score': int(home_score.strip()) if home_score and home_score.strip().isdigit() else None,
                                'away_score': int(away_score.strip()) if away_score and away_score.strip().isdigit() else None,
                                'status': status,
                                'scraped_at': datetime.now().isoformat(),
                            }
                            
                            matches.append(match_data)
                            logger.info(f"  📋 {idx+1}. {home_team} vs {away_team} ({status})")
                            
                        except Exception as e:
                            logger.debug(f"  ⚠️ 경기 {idx+1} 파싱 실패: {e}")
                            continue
                    
                    break
                    
            except Exception as e:
                logger.debug(f"셀렉터 {selector} 실패: {e}")
                continue
        
        if not matches:
            logger.warning("⚠️ 라이브스코어에서 경기를 찾지 못했습니다. 페이지 스크린샷 저장...")
            page.screenshot(path='livescore_debug.png')
        
    except Exception as e:
        logger.error(f"❌ 라이브스코어 크롤링 오류: {e}")
        page.screenshot(path='livescore_error.png')
    
    logger.info(f"✅ 라이브스코어 크롤링 완료: {len(matches)}개 경기")
    return matches


def merge_matches(betman_matches: List[Dict], livescore_matches: List[Dict]) -> List[Dict]:
    """두 소스의 경기 데이터 매칭 및 병합"""
    logger.info("🔗 경기 데이터 매칭 시작...")
    merged = []
    
    for betman_match in betman_matches:
        best_match = None
        best_score = 0
        
        # 라이브스코어에서 가장 유사한 경기 찾기
        for live_match in livescore_matches:
            # 홈팀과 원정팀 모두 유사도 체크
            home_match = match_team_names(betman_match['home_team'], live_match['home_team'])
            away_match = match_team_names(betman_match['away_team'], live_match['away_team'])
            
            if home_match and away_match:
                # 정확히 매칭됨
                best_match = live_match
                break
            
            # 부분 매칭도 고려
            score = (
                fuzz.ratio(normalize_team_name(betman_match['home_team']), normalize_team_name(live_match['home_team'])) +
                fuzz.ratio(normalize_team_name(betman_match['away_team']), normalize_team_name(live_match['away_team']))
            ) / 2
            
            if score > best_score and score > 70:
                best_score = score
                best_match = live_match
        
        # 병합된 데이터 생성
        merged_match = {
            **betman_match,
            'livescore_home_team': best_match['home_team'] if best_match else None,
            'livescore_away_team': best_match['away_team'] if best_match else None,
            'home_score': best_match.get('home_score') if best_match else None,
            'away_score': best_match.get('away_score') if best_match else None,
            'status': best_match.get('status', 'scheduled') if best_match else 'scheduled',
            'match_score': best_score if best_match else 0,
        }
        
        merged.append(merged_match)
        
        if best_match:
            logger.info(f"  ✅ 매칭: {betman_match['home_team']} vs {betman_match['away_team']} (유사도: {best_score:.1f}%)")
        else:
            logger.info(f"  ⚠️ 미매칭: {betman_match['home_team']} vs {betman_match['away_team']}")
    
    logger.info(f"✅ 매칭 완료: {len(merged)}개 경기")
    return merged


def save_to_supabase(matches: List[Dict]) -> tuple:
    """Supabase에 데이터 저장 (upsert)"""
    logger.info("💾 Supabase 저장 시작...")
    saved_count = 0
    error_count = 0
    
    for match in matches:
        try:
            # 데이터 준비
            data = {
                'match_time': match.get('match_time'),
                'sport': match.get('sport'),
                'home_team': match['home_team'],
                'away_team': match['away_team'],
                'odds_home': match.get('odds_home'),
                'odds_draw': match.get('odds_draw'),
                'odds_away': match.get('odds_away'),
                'home_score': match.get('home_score'),
                'away_score': match.get('away_score'),
                'status': match.get('status', 'scheduled'),
                'source': match.get('source', 'betman'),
                'match_score': match.get('match_score', 0),
                'scraped_at': match.get('scraped_at'),
                'updated_at': datetime.now().isoformat(),
            }
            
            # Upsert (고유 키: home_team + away_team + match_time)
            result = supabase.table('sports_matches').upsert(
                data,
                on_conflict='home_team,away_team,match_time'
            ).execute()
            
            saved_count += 1
            
        except Exception as e:
            logger.error(f"  ❌ 저장 실패: {match['home_team']} vs {match['away_team']} - {e}")
            error_count += 1
    
    logger.info(f"✅ Supabase 저장 완료: {saved_count}개 성공, {error_count}개 실패")
    return saved_count, error_count


def main():
    """메인 실행 함수"""
    logger.info("=" * 60)
    logger.info("🚀 베트맨/라이브스코어 크롤링 시작")
    logger.info("=" * 60)
    
    start_time = time.time()
    
    with sync_playwright() as playwright:
        browser = setup_browser(playwright)
        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        page = context.new_page()
        
        try:
            # 1. 베트맨 크롤링
            betman_matches = scrape_betman(page)
            random_sleep(3, 5)
            
            # 2. 라이브스코어 크롤링
            livescore_matches = scrape_livescore(page)
            random_sleep(2, 4)
            
            # 3. 데이터 매칭
            if betman_matches:
                merged_matches = merge_matches(betman_matches, livescore_matches)
                
                # 4. Supabase 저장
                if merged_matches:
                    saved, errors = save_to_supabase(merged_matches)
                    
                    elapsed = time.time() - start_time
                    logger.info("=" * 60)
                    logger.info(f"✅ 크롤링 완료!")
                    logger.info(f"  • 베트맨: {len(betman_matches)}개")
                    logger.info(f"  • 라이브스코어: {len(livescore_matches)}개")
                    logger.info(f"  • 저장: {saved}개 성공, {errors}개 실패")
                    logger.info(f"  • 소요 시간: {elapsed:.1f}초")
                    logger.info("=" * 60)
                else:
                    logger.warning("⚠️ 병합된 경기가 없습니다.")
            else:
                logger.warning("⚠️ 베트맨에서 경기를 가져오지 못했습니다.")
            
        except Exception as e:
            logger.error(f"❌ 크롤링 중 치명적 오류: {e}")
            
        finally:
            context.close()
            browser.close()
            logger.info("🔚 브라우저 종료")


if __name__ == "__main__":
    main()
