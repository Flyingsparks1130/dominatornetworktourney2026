from pathlib import Path
import copy
import json
import shutil
import sys
import tempfile
import threading
import unittest
import urllib.request
import urllib.error
import http.cookiejar

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from tournament_engine import ARCHIVE,TournamentError,build,normalize_race,mutate,import_race,read_json,time_display,save_draft
from tournament_draft import blank_draft
from tournament_admin import serve
from apply_lhncfl import apply as apply_lhncfl

def fixture(seed=100):
    horses=[]
    for i in range(10):
        owner=f'Player {i+1}'
        horses.append({'horseIndex':i,'postNumber':min(i+1,8),'charaName':'Same Character' if i in (0,1) else f'Uma {i+1}',
          'finishOrder':i,'finishTimeRaw':100+i*.2,'finishTimeScaled':125+i*.25,'trainerName':owner,'isGhost':True,
          'responseHorseData':{'trainer_name':'Host only','owner_trainer_name':owner,'frame_order':i+1,'card_id':100100+i,'running_style':1,'npc_type':11,'skill_array':[]},
          'raceParam':{'rawSpeed':1400,'rawStamina':900,'rawPow':1000,'rawGuts':600,'rawWiz':900},'trainedCharaData':{}})
    return {'horseACT_version':'1.1.7','numRaceHorses':10,'raceHorse':horses,'playerTeamMemberArray':horses[:3],
     'playerTeamTopFinishOrderHorse':horses[0],'randomSeed':seed,'raceCourseSet':{'distance':2200,'ground':1,'id':10308,'raceTrackId':10003},
     'rotationCategory':'Left','groundCondition':'Good','weather':'Sunny','season':'Summer'}

class EngineTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
        shutil.copytree(ROOT/ARCHIVE,self.root/ARCHIVE)
        # Each test starts with clean organizer state, irrespective of any local demo activity.
        p=self.root/ARCHIVE/'control.json';p.write_text(json.dumps({'schema_version':1,'revision':0,'decisions':{},'race_overrides':{},'roster':{},'audit':[]}))
        for rd in (self.root/ARCHIVE).glob('R*'):
            for f in rd.rglob('*.json'):
                if f.name!='match.json':f.unlink()
    def tearDown(self):self.tmp.cleanup()
    def command(self,action,mid='r1-m1',**extra):
        rev=read_json(self.root/ARCHIVE/'control.json')['revision']
        return mutate(self.root,{'action':action,'match_id':mid,'revision':rev,'reason':'Test organizer ruling',**extra})
    def upload(self,raw=None,**extra):
        rev=read_json(self.root/ARCHIVE/'control.json')['revision']
        data={'revision':rev,'match_id':'r1-m1','file_name':'test.json','race_folder':'01 - 2200m Turf','race_json':raw or fixture()};data.update(extra)
        return import_race(self.root,data)
    def test_zero_based_and_no_subset_duplicates(self):
        r=normalize_race(fixture());self.assertEqual(len(r['results']),10);self.assertEqual([x['place'] for x in r['results']],list(range(1,11)))
        self.assertEqual(sum(x['uma']=='Same Character' for x in r['results']),2)
    def test_owner_not_capture_trainer(self):
        r=normalize_race(fixture());self.assertEqual(r['results'][0]['owner'],'Player 1');self.assertEqual(r['results'][0]['capture_trainer'],'Host only')
    def test_raw_scaled_and_gate_distinction(self):
        r=normalize_race(fixture());self.assertEqual(r['results'][0]['raw_seconds'],100);self.assertEqual(r['results'][0]['scaled_seconds'],125)
        self.assertEqual(r['results'][9]['gate'],10);self.assertEqual(r['results'][9]['post_number'],8)
        self.assertEqual(time_display(59.9999),'1:00.000')
    def test_duplicate_place_rejected(self):
        f=fixture();f['raceHorse'][1]['finishOrder']=0
        with self.assertRaises(TournamentError):normalize_race(f)
    def test_incomplete_data_rejected(self):
        f=fixture();f['raceHorse'].pop()
        with self.assertRaises(TournamentError):normalize_race(f)
    def test_shape_from_user_image(self):
        r=build(self.root,write=False)['index'];self.assertEqual(len(r['teams']),11)
        self.assertEqual([sum(m['round']==f'R{i}' for m in r['matches']) for i in range(1,5)],[3,4,2,1])
        self.assertEqual(sum('team' in s for m in r['matches'] if m['round']=='R2' for s in m['sources']),5)
        self.assertFalse(r['eliminated']);self.assertIsNone(r['champion_id'])
    def test_unmapped_not_official_scores_or_npc(self):
        r=self.upload();race=next(iter(r['races'].values()));self.assertFalse(race['scoring_verified'])
        self.assertTrue(all(x['eligible'] for x in race['results']))
        self.assertIsNone(next(m for m in r['index']['matches'] if m['id']=='r1-m1')['scores'])
    def test_mapping_and_npc_points_roll_down(self):
        r=self.upload();rid=next(iter(r['races']));a={str(i):{'team_id':'dominion' if i<5 else 'dominarium','eligible':i!=0} for i in range(10)}
        r=self.command('mapping',race_id=rid,assignments=a,remember_owners=True);race=r['races'][rid]
        self.assertTrue(race['scoring_verified']);self.assertEqual([x['points'] for x in race['results'][:5]],[0,4,2,1,0])
    def test_reject_more_than_five_per_team(self):
        r=self.upload();rid=next(iter(r['races']));a={str(i):{'team_id':'dominion','eligible':True} for i in range(10)}
        r=self.command('mapping',race_id=rid,assignments=a)
        self.assertFalse(r['races'][rid]['scoring_verified'])
    def test_manual_score_survives_rebuild(self):
        self.command('score',scores={'dominion':25,'dominarium':18})
        self.assertEqual(build(self.root)['index']['matches'][0]['scores'],{'dominion':25,'dominarium':18})
        self.assertIsNone(build(self.root)['index']['matches'][0]['winner_id'])
    def test_advance_eliminate_and_fill_next(self):
        self.command('score',scores={'dominion':25,'dominarium':10})
        r=self.command('advance',winner_id='dominion')['index'];m=next(m for m in r['matches'] if m['id']=='r2-m1')
        self.assertEqual([p['id'] for p in m['participants']],['dominator','dominion']);self.assertIn('dominarium',r['eliminated'])
        finished=next(m for m in r['matches'] if m['id']=='r1-m1')
        self.assertEqual(finished['status'],'complete');self.assertTrue(finished['score_only']);self.assertEqual(finished['races'],[])
        self.assertEqual(finished['scores'],{'dominion':25,'dominarium':10})
    def test_full_progression(self):
        choices={'r1-m1':'dominion','r1-m2':'domineer','r1-m3':'dominium','r2-m1':'dominator','r2-m2':'dominance','r2-m3':'dominacion','r2-m4':'dominate','r3-m1':'dominator','r3-m2':'dominate','r4-m1':'dominator'}
        for mid,w in choices.items():r=self.command('advance',mid,winner_id=w)
        self.assertEqual(r['index']['champion_id'],'dominator');self.assertEqual(len(r['index']['eliminated']),10)
    def test_downstream_change_guard(self):
        self.command('advance',winner_id='dominion');self.command('score','r2-m1',scores={'dominator':1,'dominion':2})
        with self.assertRaises(TournamentError):self.command('advance',winner_id='dominarium')
    def test_forfeit_and_reopen(self):
        self.command('forfeit',winner_id='dominion');r=self.command('reopen')['index'];self.assertFalse(r['eliminated'])
    def test_stale_revision(self):
        self.command('score',scores={'dominion':1,'dominarium':2})
        with self.assertRaises(TournamentError):mutate(self.root,{'action':'score','revision':0,'reason':'Old page','match_id':'r1-m1','scores':{'dominion':3,'dominarium':4}})
    def test_original_bytes_preserved(self):
        f=fixture();text=json.dumps(f,indent=3)+'\n';self.upload(f,raw_text=text)
        target=self.root/ARCHIVE/'R1/Dominion vs Dominarium/01 - 2200m Turf/test.json'
        self.assertEqual(target.read_bytes(),text.encode())
    def test_duplicate_content_rejected(self):
        self.upload()
        with self.assertRaises(TournamentError):self.upload(file_name='different-name.json')
    def test_traversal_rejected(self):
        for part in ('../escape','a/b','a\\b','CON','a:bad'):
            with self.assertRaises(TournamentError):self.upload(race_folder=part)
    def test_manual_folder_discovery(self):
        p=self.root/ARCHIVE/'Round 1'/'DomiChill vs Domineer'/'01 - Race & course';p.mkdir(parents=True)
        (p/'raw export.json').write_text(json.dumps(fixture()))
        r=build(self.root);self.assertEqual(next(iter(r['races'].values()))['match_id'],'r1-m2')
    def test_no_advancement_before_participants(self):
        with self.assertRaises(TournamentError):self.command('advance','r4-m1',winner_id='dominator')
    def draft(self,mid='r1-m1',**fields):
        raw=blank_draft(mid);raw.update(fields)
        rev=read_json(self.root/ARCHIVE/'control.json')['revision']
        return save_draft(self.root,{'revision':rev,'match_id':mid,'reason':'Record match draft','draft_json':raw})
    def test_drafts_are_isolated_from_other_matches_and_races(self):
        r=self.draft(track_pool=['R1 pool'],track_picks=[{'team_id':'dominion','track':'2200m Turf'}])
        r=self.draft('r2-m2',track_pool=['R2 pool'],final_tracks=['1600m Turf'])
        by_id={m['id']:m for m in r['index']['matches']}
        self.assertEqual(by_id['r1-m1']['draft']['track_pool'],['R1 pool'])
        self.assertEqual(by_id['r2-m2']['draft']['track_pool'],['R2 pool'])
        self.assertEqual(r['races'],{});self.assertFalse(any(m['scores'] or m['winner_id'] for m in by_id.values()))
        folder=self.root/ARCHIVE/'R1/Dominion vs Dominarium';folder.rename(folder.with_name('Renamed match'))
        self.assertEqual(build(self.root)['index']['matches'][0]['draft']['track_pool'],['R1 pool'])
    def test_wrong_draft_match_and_club_rejected_without_overwrite(self):
        self.draft(track_pool=['Keep this pool'])
        path=self.root/ARCHIVE/'R1/Dominion vs Dominarium/draft.json';before=path.read_bytes()
        for raw in [blank_draft('r2-m2'),dict(blank_draft('r1-m1'),track_picks=[{'team_id':'dominator','track':'Wrong club'}])]:
            with self.assertRaises(TournamentError):
                save_draft(self.root,{'revision':1,'match_id':'r1-m1','reason':'Invalid draft','draft_json':raw})
        self.assertEqual(path.read_bytes(),before)
        with self.assertRaises(TournamentError):
            save_draft(self.root,{'revision':0,'match_id':'r1-m1','reason':'Stale edit','draft_json':blank_draft('r1-m1')})
    def test_r2_json_scores_and_historical_draft_coexist(self):
        r=self.upload(match_id='r2-m2');rid=next(iter(r['races']))
        self.command('score','r2-m2',scores={'dominance':25,'dominant-h':10})
        self.command('advance','r2-m2',winner_id='dominance')
        r=self.draft('r2-m2',status='locked',final_tracks=['Race '+str(i) for i in range(1,6)])
        m=next(m for m in r['index']['matches'] if m['id']=='r2-m2')
        self.assertEqual(m['scores'],{'dominance':25,'dominant-h':10});self.assertEqual(m['winner_id'],'dominance')
        self.assertFalse(m['score_only']);self.assertEqual(m['races'][0]['id'],rid);self.assertEqual(len(m['draft']['final_tracks']),5)
    def test_downstream_populated_draft_blocks_earlier_winner_change(self):
        self.command('advance',winner_id='dominion')
        self.draft('r2-m1',track_picks=[{'team_id':'dominion','track':'2200m Turf'}])
        with self.assertRaises(TournamentError):self.command('reopen')
        self.assertEqual(build(self.root)['index']['matches'][0]['winner_id'],'dominion')
    def test_downstream_empty_template_does_not_block_winner_change(self):
        self.command('advance',winner_id='dominion');self.draft('r2-m1')
        r=self.command('advance',winner_id='dominarium')
        self.assertEqual(next(m for m in r['index']['matches'] if m['id']=='r2-m1')['participants'][1]['id'],'dominarium')
    def install_lhncfl(self):
        folder = Path(ARCHIVE)/'R1/Dominion vs Dominarium'
        for name in ('draft.json', 'results.json'):
            shutil.copy2(ROOT/'tests/fixtures/LHNCFL'/name, self.root/folder/name)
        return self.root/folder
    def test_lhncfl_report_verifies_all_seven_scores_without_raw_exports(self):
        self.install_lhncfl()
        state=build(self.root);m=state['index']['matches'][0];report=m['reported_results']
        self.assertEqual(report['totals'],{'dominion':22,'dominarium':27})
        self.assertEqual([(r['scores']['dominion'],r['scores']['dominarium']) for r in report['races']],
                         [(2,5),(3,4),(3,4),(4,3),(3,4),(5,2),(2,5)])
        self.assertEqual(report['races'][5]['cumulative_scores'],{'dominion':20,'dominarium':22})
        self.assertTrue(report['races'][6]['tiebreaker'])
        self.assertEqual(report['mvp']['discord'],'@LESKBILL')
        self.assertEqual(sum(p['points'] for r in report['races'] for p in r['podium'] if p['discord']=='@LESKBILL'),12)
        self.assertEqual(len(m['draft']['roster']),12);self.assertEqual(len(m['draft']['final_tracks']),6)
        self.assertEqual(m['races'],[]);self.assertEqual(state['races'],{})
        self.assertIsNone(m['scores']);self.assertIsNone(m['winner_id'])
    def test_apply_lhncfl_is_idempotent_and_preserves_other_decisions(self):
        self.install_lhncfl()
        self.command('score','r2-m2',scores={'dominance':14,'dominant-h':21})
        before=read_json(self.root/ARCHIVE/'control.json')
        state=apply_lhncfl(self.root);m=state['index']['matches'][0]
        self.assertEqual(m['winner_id'],'dominarium');self.assertEqual(m['scores'],{'dominion':22,'dominarium':27})
        self.assertIn('dominion',state['index']['eliminated']);self.assertTrue(m['score_only'])
        qf=next(m for m in state['index']['matches'] if m['id']=='r2-m1')
        self.assertEqual([p['id'] for p in qf['participants']],['dominator','dominarium'])
        after=read_json(self.root/ARCHIVE/'control.json')
        self.assertEqual(after['decisions']['r2-m2'],before['decisions']['r2-m2'])
        self.assertEqual(after['revision'],before['revision']+1)
        apply_lhncfl(self.root)
        self.assertEqual(read_json(self.root/ARCHIVE/'control.json'),after)
    def test_lhncfl_conflict_does_not_overwrite_scores_or_winner(self):
        self.install_lhncfl();self.command('score',scores={'dominion':25,'dominarium':24})
        before=(self.root/ARCHIVE/'control.json').read_bytes()
        with self.assertRaises(TournamentError):apply_lhncfl(self.root)
        self.assertEqual((self.root/ARCHIVE/'control.json').read_bytes(),before)
    def test_report_rejects_bench_duplicate_or_wrong_variant(self):
        folder=self.install_lhncfl();path=folder/'results.json';original=read_json(path)
        for bad in [dict(team_id='dominion',uma='Mejiro Palmer',discord='@Flareon'),
                    dict(team_id='dominion',uma='Oguri Cap',discord='@Flareon'),
                    original['races'][0]['podium'][1]]:
            raw=copy.deepcopy(original);raw['races'][0]['podium'][0]=bad;path.write_text(json.dumps(raw))
            with self.assertRaises(TournamentError):build(self.root)
    def test_report_and_race_export_are_never_added_together(self):
        self.install_lhncfl()
        state=self.upload();rid=next(iter(state['races']))
        apply_lhncfl(self.root)
        state=self.command('mapping',race_id=rid,assignments={str(i):{'team_id':'dominion' if i<5 else 'dominarium','eligible':True} for i in range(10)})
        m=state['index']['matches'][0]
        self.assertEqual(m['scores'],{'dominion':22,'dominarium':27})
        self.assertEqual(m['computed_scores'],{'dominion':7,'dominarium':0})
        self.assertEqual(m['reported_results']['totals'],{'dominion':22,'dominarium':27})
        self.assertFalse(m['score_only'])
    def test_http_csrf_host_and_write(self):
        s=serve(self.root,0);thread=threading.Thread(target=s.serve_forever,daemon=True);thread.start()
        base=f'http://127.0.0.1:{s.server_port}'
        opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        try:
            session=json.load(opener.open(base+'/api/session'))
            data={'revision':0,'action':'score','match_id':'r1-m1','reason':'Verified scores','scores':{'dominion':10,'dominarium':4}}
            req=urllib.request.Request(base+'/api/control',data=json.dumps(data).encode(),headers={'Content-Type':'application/json','Origin':base})
            with self.assertRaises(urllib.error.HTTPError) as fail:opener.open(req)
            self.assertEqual(fail.exception.code,403)
            req.add_header('X-CSRF-Token',session['csrf']);result=json.load(opener.open(req));self.assertEqual(result['index']['revision'],1)
            draft=dict(blank_draft('r1-m1'),track_pool=['Local draft pool'])
            body={'revision':1,'match_id':'r1-m1','reason':'Record local draft','draft_json':draft}
            req=urllib.request.Request(base+'/api/draft',data=json.dumps(body).encode(),headers={'Content-Type':'application/json','Origin':base})
            with self.assertRaises(urllib.error.HTTPError) as fail:opener.open(req)
            self.assertEqual(fail.exception.code,403)
            req.add_header('X-CSRF-Token',session['csrf']);result=json.load(opener.open(req))
            self.assertEqual(result['index']['matches'][0]['draft']['track_pool'],['Local draft pool'])
            req=urllib.request.Request(base+'/api/session',headers={'Host':'evil.example'})
            with self.assertRaises(urllib.error.HTTPError) as fail:opener.open(req)
            self.assertEqual(fail.exception.code,403)
        finally:s.shutdown();s.server_close();thread.join()

if __name__=='__main__':unittest.main()
