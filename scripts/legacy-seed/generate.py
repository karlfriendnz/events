#!/usr/bin/env python3
"""
Legacy FULL-CLUB seed generator (FriendlyManager `fm_tmpl-` MySQL schema).

Populates EVERY base table in the per-club schema with coherent, referentially
valid, deterministic data — the source dataset the new-platform migration ETL
consumes. Club-parameterised so N clubs can be produced by looping.

  python3 generate.py --slug demo --persons 1000 --groups 100 --comps 2 --seed 42
    -> writes out/<slug>.sql  (+ prints per-table coverage & reconciliation)

FK-safe insert order; explicit integer ids (per-club id space, like legacy
db-per-club); `guid`/`status`/other defaulted columns are omitted and left to
their column defaults; every NOT-NULL-without-default column is filled.
"""
import argparse, os, random, datetime as dt

# ------------------------------------------------------------------ helpers
class Gen:
    def __init__(self, cfg):
        self.cfg = cfg
        self.rng = random.Random(cfg["seed"])
        self.ids = {}
        self.buf = []
        self.counts = {}

    def nid(self, t):
        self.ids[t] = self.ids.get(t, 0) + 1
        return self.ids[t]

    def emit(self, s): self.buf.append(s)

    def insert(self, table, cols, rows):
        self.counts[table] = self.counts.get(table, 0) + len(rows)
        if not rows: return
        collist = ", ".join("`" + c + "`" for c in cols)
        for i in range(0, len(rows), 500):
            chunk = rows[i:i+500]
            self.emit(f"INSERT INTO `{table}` ({collist}) VALUES")
            self.emit(",\n".join("(" + ", ".join(r) + ")" for r in chunk) + ";")

R = None  # set per build
def q(s):
    if s is None: return "NULL"
    return "'" + str(s).replace("\\", "\\\\").replace("'", "''") + "'"
def dd(x): return "NULL" if x is None else "'" + x.isoformat() + "'"
def n(x): return "NULL" if x is None else str(x)
def money(x): return f"{x:.2f}"

FIRST = ("Olivia Charlotte Amelia Isla Mia Ava Grace Ella Sophie Ruby Emily Lily Zoe Hana "
    "Jack Oliver William Noah James Leo Lucas Henry George Max Hunter Cooper Eli "
    "Aroha Nikau Anahera Wiremu Kahu Tane Manaia Aria Maia Ari Ruben").split()
LAST = ("Smith Williams Brown Taylor Wilson Thompson Walker Wright Anderson Jones "
    "Ngata Rewiti Kingi Katene Waititi Patel Singh Chen Wang Kaur Nguyen Lee "
    "Mitchell Campbell Robertson Clarke Harris Scott Baker Adams Reddy Osei").split()
FEMALE = set("Olivia Charlotte Amelia Isla Mia Ava Grace Ella Sophie Ruby Emily Lily Zoe Hana Aroha Anahera Aria Maia".split())
STREETS = ("Beach Rd","Hillcrest Ave","Sunset Blvd","Kauri St","Totara Cres","Marina Pde","Rimu Way","Victoria St","Queen St","Albany Hwy")
SUBURBS = ("Albany","Takapuna","Devonport","Milford","Browns Bay","Glenfield","Hillcrest","Sunnynook")
BCRYPT = "$2y$10$4ZFVSAqGXmcSgIHQPs1j9ObWqYNlU0BD.FVxiDLVe80VbQ8pBWYtW"  # bcrypt("Password1!")
PROGRAMMES = [("Recreational",["Rec Juniors","Rec Seniors"]),("Development",["Dev Squad","Dev Advanced"]),
    ("Competitive",["Comp Level 3","Comp Level 5","Comp Elite"]),("Adults",["Adult Fitness"]),
    ("Preschool",["KindyGym","Tumble Tots"]),("Holiday",["Holiday Programme"])]
Z = "'0000-00-00'"   # legacy sentinel date (relaxed sql_mode)

# ================================================================== build
def build(cfg):
    g = Gen(cfg)
    r = g.rng
    NP, NG, NC = cfg["persons"], cfg["groups"], cfg["comps"]

    # ---- 1. TERM (4 terms relative to TODAY: 2 past, 1 CURRENT, 1 future) --
    TODAY = dt.date.today(); TLEN = 77; GAP = 14  # 11-wk terms, 2-wk gaps
    t3s = TODAY - dt.timedelta(days=21)            # term 3 contains today
    step = TLEN + GAP
    starts = [t3s - dt.timedelta(days=2*step), t3s - dt.timedelta(days=step), t3s, t3s + dt.timedelta(days=step)]
    TERMW = [(f"Term {i+1} {s.year}", s, s+dt.timedelta(days=TLEN)) for i,s in enumerate(starts)]
    terms=[]; rows=[]
    for name,s,e in TERMW:
        tid=g.nid("Term"); terms.append((tid,name,s,e))
        rows.append([str(tid),q(name),dd(s),dd(e),dd(s-dt.timedelta(days=28)),
                     dd(s+dt.timedelta(days=14)),dd(s-dt.timedelta(days=42)),"1","1","0"])
    g.insert("Term",["id","name","start","end","signupOpenDate","signupCloseDate","preOpenDate","signupEmailed","transferable","termset"],rows)

    # ---- 2. CODE (programme hierarchy) ----------------------------------
    codes=[]; leaf=[]; rows=[]; o=0
    for pname,kids in PROGRAMMES:
        o+=1; pid=g.nid("Code"); codes.append(pid)
        rows.append([str(pid),q(pname),"NULL","0",str(o),"1"])
        for kn in kids:
            o+=1; cid=g.nid("Code"); codes.append(cid); leaf.append(cid)
            rows.append([str(cid),q(kn),str(pid),"0",str(o),"1"])
    g.insert("Code",["id","name","parentID","termset","order","publish"],rows)

    # ---- 3. PERSON ------------------------------------------------------
    persons=[]; coaches=[]; rows=[]
    ncoach=max(8,int(NP*0.06))
    for i in range(1,NP+1):
        pid=g.nid("Person"); is_c=i<=ncoach
        first=r.choice(FIRST); last=r.choice(LAST)
        gender="Female" if first in FEMALE else "Male"
        age=r.randint(19,55) if is_c else r.randint(4,17)
        role=(6 if i<=3 else 2) if is_c else 1
        if is_c: coaches.append(pid)
        dob=dt.date(2025-age,r.randint(1,12),r.randint(1,28))
        email=(f"admin@{cfg['slug']}.local" if pid==1 else f"{first.lower()}.{last.lower()}{pid}@{cfg['slug']}.demo")
        ll=dt.datetime(2025,12,r.randint(1,20),r.randint(6,21),r.randint(0,59))
        persons.append({"id":pid,"coach":is_c,"dob":dob,"gender":gender,"first":first,"last":last})
        rows.append([str(pid),q(first),q(last),q(gender),str(role),q(email),q(BCRYPT),
            q(ll.strftime("%Y-%m-%d %H:%M:%S")),dd(dob),
            q(f"02{r.randint(10,29)} {r.randint(100,999)} {r.randint(1000,9999)}"),"''",
            q(f"{r.randint(1,299)} {r.choice(STREETS)}"),q(r.choice(SUBURBS)),q("Auckland"),
            q("New Zealand"),q(f"06{r.randint(10,49)}"),"''","''","1",Z,"0"])
    g.insert("Person",["id","firstName","lastName","gender","role","email","password","lastLoggedIn",
        "dateOfBirth","phone","alternatePhone","street","suburb","city","country","postCode",
        "medical","notes","relatedComms","resignDate","invalidEmail"],rows)
    members=[p["id"] for p in persons if not p["coach"]]
    pby={p["id"]:p for p in persons}
    clubreps=coaches[:8] or coaches[:1]   # persons acting as "comp club" contacts

    # ---- 4. VENUE + times ----------------------------------------------
    venues=[]; rows=[]
    vnames=["Main Stadium","North Hall","Training Annex","Community Centre","Outdoor Courts"]
    for i,vn in enumerate(vnames):
        vid=g.nid("Venue"); venues.append(vid)
        rows.append([str(vid),q(vn),q(f"{r.randint(1,99)} {r.choice(STREETS)}, Auckland"),
            q("Club facility"),n(r.choice(coaches)),"4","30","0","''","''","NULL","''",str(i)])
    g.insert("Venue",["id","name","location","description","personID","maxBookings","maxDays","minDays",
        "emailContent","instructions","parentID","memberGroups","order"],rows)
    # VenueTime
    vtimes=[]; rows=[]
    for vid in venues:
        for day in r.sample(range(1,8),r.randint(2,4)):
            vtid=g.nid("VenueTime"); vtimes.append((vtid,vid))
            rows.append([str(vtid),str(vid),q("Court hire"),str(day),"'16:00:00'","'21:00:00'",
                "0","1",money(r.choice([10,15,20])),money(r.choice([25,30,40]))])
    g.insert("VenueTime",["id","venueID","label","day","startTime","endTime","term","book","memberFee","publicFee"],rows)
    # VenueLink
    rows=[[str(vid),str(vtid)] for (vtid,vid) in r.sample(vtimes,min(len(vtimes),8))]
    g.insert("VenueLink",["venueID","venueTimeID"],rows)
    # VenueSport
    rows=[[str(vid),str(r.randint(1,4))] for vid in venues]
    g.insert("VenueSport",["venueID","compSportID"],rows)

    # ---- 5. PROGRAM (holiday programmes) -------------------------------
    programs=[]; rows=[]
    for i in range(3):
        pid=g.nid("Program"); programs.append(pid)
        rows.append([str(pid),q(f"Holiday Programme {i+1}"),dd(dt.date(2025,7,1)),dd(dt.date(2025,7,14)),
            money(r.choice([40,50,60])),money(r.choice([12,15])),dd(dt.date(2025,7,20)),str(r.choice([4,6])),str(r.choice([12,14]))])
    g.insert("Program",["id","name","open","close","cost","dayCost","feeDue","startAge","endAge"],rows)

    # ---- 6. GROUP + times ----------------------------------------------
    groups=[]; rows=[]
    for gi in range(1,NG+1):
        gid=g.nid("Group"); code=r.choice(leaf); head=r.choice(coaches)
        lim=r.choice((8,10,12,14,16,20)); sa=r.choice((4,6,8,10,12))
        groups.append({"id":gid,"code":code,"head":head,"limit":lim})
        rows.append([str(gid),str(gi),q(f"Group {gid}"),str(code),str(head),str(r.choice((6,8,10))),
            str(lim),"1","''",str(sa),str(sa+r.choice((2,3,4))),str(r.choice((0,0,0,1,2))),q(f"G{gid:03d}")])
    g.insert("Group",["id","order","name","codeID","headID","playersPerStaff","limit","public",
        "description","startAge","endAge","gender","shortCode"],rows)
    rows=[]
    for gr in groups:
        for day in r.sample(range(1,8),r.randint(1,2)):
            rows.append([str(g.nid("GroupTime")),str(gr["id"]),str(day),"'15:30:00'","'17:00:00'",n(r.choice(venues))])
    g.insert("GroupTime",["id","groupID","day","startTime","endTime","venueID"],rows)

    # ---- 7. PERSONGROUP (4 terms, churn) + PersonCode ------------------
    pg=[]; seen=set(); memb=[]; roster={gr["id"]:set() for gr in groups}
    for (tid,tn,ts,te) in terms:
        for gr in groups:
            gid=gr["id"]; ro=roster[gid]
            if ro:
                keep=int(len(ro)*0.75); ro=set(r.sample(sorted(ro),keep)) if keep else set()
            tgt=int(gr["limit"]*r.uniform(0.6,0.95))
            while len(ro)<tgt: ro.add(r.choice(members))
            roster[gid]=ro
            for pid in ro:
                k=(pid,gid,tid,0)
                if k in seen: continue
                seen.add(k); pg.append([str(pid),str(gid),str(tid),"0","''"]); memb.append((pid,gid,tid))
            k=(gr["head"],gid,tid,1)
            if k not in seen:
                seen.add(k); pg.append([str(gr["head"]),str(gid),str(tid),"1",q("Head Coach")])
    g.insert("PersonGroup",["personID","groupID","termID","staff","position"],pg)
    # PersonCode: put each person under a random top-level code
    pc=set(); rows=[]
    for pid in [p["id"] for p in persons]:
        c=r.choice(codes)
        if (pid,c) not in pc: pc.add((pid,c)); rows.append([str(pid),str(c)])
    g.insert("PersonCode",["personID","codeID"],rows)

    # ---- 8. PERSON extras: Contact, Tag, VaccinePass, AuthToken --------
    rows=[]; used=set()
    for pid in members:
        if r.random()<0.6:   # a guardian contact (a coach-age person)
            c=r.choice(coaches)
            if (pid,c) not in used and c!=pid:
                used.add((pid,c)); rows.append([str(pid),str(c),q(r.choice(["Mother","Father","Guardian"])),str(r.choice([0,1]))])
    g.insert("PersonContact",["personID","contactID","relationship","ec"],rows)
    rows=[[n(pid),q(t)] for pid in r.sample(members,min(len(members),120)) for t in [r.choice(["Life Member","Volunteer","Scholarship","New 2025"])]]
    g.insert("PersonTag",["personID","tag"],rows)
    rows=[]
    for pid in r.sample(members,min(len(members),80)):
        p=pby[pid]; vf=dt.date(2025,1,1)
        rows.append([str(g.nid("VaccinePass")),q(p["first"]),q(p["last"]),dd(p["dob"]),str(pid),
            dd(vf),dd(dt.date(2026,1,1)),dd(dt.date(2025,2,1)),n(r.choice(coaches)),dd(dt.date(2025,2,2))])
    g.insert("VaccinePass",["id","firstName","lastName","dob","personID","validFrom","expiryDate","scanDate","sightedByID","sightedDate"],rows)
    rows=[[q(f"tk{i:06d}"),q(f"{'a'*64}"),str(r.choice(coaches)),q("remember")] for i in range(1,11)]
    g.insert("AuthToken",["selector","validatorHash","userID","type"],rows)

    # ---- 9. TERMFEE(+items) / FEE / TRANSACTION / FeeRecur / Discount --
    tf=[]; tfi=[]; tfof={}
    for (tid,tn,ts,te) in terms:
        for gr in groups:
            gid=gr["id"]; tfid=g.nid("TermFee"); amt=r.choice((80,95,120,140,160,185,210))
            items=r.random()<0.35; tfof[(gid,tid)]=(tfid,amt)
            tf.append([str(tfid),q(f"{tn} fee"),str(tid),str(gid),"NULL",f"{amt:.4f}",dd(ts+dt.timedelta(days=21)),q("200"),"0","14","1" if items else "0"])
            if items:
                p=round(amt*0.6); tfi.append([str(g.nid("TermFeeItem")),str(tfid),q("Coaching"),f"{p:.4f}",q("200")])
                tfi.append([str(g.nid("TermFeeItem")),str(tfid),q("Facility"),f"{amt-p:.4f}",q("201")])
    g.insert("TermFee",["id","name","termID","groupID","codeID","amount","dueDate","account","type","dueDays","hasLineItems"],tf)
    g.insert("TermFeeItem",["id","termFeeID","name","amount","account"],tfi)
    fee=[]; txn=[]; inv=0.0; paid=0.0; recur=[]
    for (pid,gid,tid) in memb:
        tfid,amt=tfof[(gid,tid)]; fid=g.nid("Fee")
        ts=next(t[2] for t in terms if t[0]==tid); fdate=ts+dt.timedelta(days=r.randint(0,10))
        inv+=amt
        fee.append([str(fid),"1",dd(fdate),dd(ts+dt.timedelta(days=21)),q("Term fee"),money(amt),str(pid),q("TermFee"),q(str(tfid)),"''","0.00"])
        roll=r.random()
        pay=amt if roll<0.8 else (round(amt*r.uniform(.3,.7),2) if roll<0.9 else 0.0)
        if pay>0:
            paid+=pay; txn.append([str(g.nid("Transaction")),dd(fdate+dt.timedelta(days=r.randint(1,30))),money(pay),str(r.choice((1,2,2,3))),str(pid),str(fid),"''"])
        if r.random()<0.05:  # a recurring fee schedule
            recur.append([str(fid),dd(fdate),"14",dd(fdate+dt.timedelta(days=180)),money(amt)])
    g.insert("Fee",["id","type","date","dueDate","name","amount","personID","assocType","assocID","notes","promptDiscount"],fee)
    g.insert("Transaction",["id","date","amount","method","personID","feeID","notes"],txn)
    g.insert("FeeRecur",["feeID","date","dueDays","endDate","amount"],recur)
    rows=[[str(g.nid("Discount")),str(nf),money(d_),str(t_)] for (nf,d_,t_) in [(2,10,1),(3,15,1),(4,20,1)]]
    g.insert("Discount",["id","numFees","discount","type"],rows)

    # ---- 10. CUSTOM FIELDS ---------------------------------------------
    cf=[]; cfnames=[("medical_conditions","Medical conditions","text"),("tshirt","T-shirt size","select"),("school","School","text")]
    cfids=[]
    for i,(field,label,typ) in enumerate(cfnames):
        cid=g.nid("CustomField"); cfids.append((cid,field,typ))
        cf.append([str(cid),q(field),q(label),q("person"),n(r.choice(codes) if i==2 else None),q(typ),
            q("S,M,L,XL" if typ=="select" else ""),"1",str(i),"''","''","''"])
    g.insert("CustomField",["id","field","name","assocType","codeID","type","values","access","order","description","conditionField","conditionValue"],cf)
    rows=[]
    sel=next(c for c in cfids if c[2]=="select")
    for i,v in enumerate(["S","M","L","XL"]):
        rows.append([str(g.nid("CustomSelectValue")),q(v),"NULL",str(sel[0]),str(i)])
    g.insert("CustomSelectValue",["id","value","parentID","customFieldID","order"],rows)
    rows=[]; cfp=set()
    for pid in r.sample(members,min(len(members),300)):
        c=r.choice(cfids)
        if (c[1],pid) in cfp: continue
        cfp.add((c[1],pid))
        val="M" if c[2]=="select" else r.choice(["None","Asthma","St Marys School","Nut allergy"])
        rows.append([q(c[1]),str(pid),q(val)])
    g.insert("CustomFieldPerson",["field","personID","value"],rows)

    # ---- 11. AWARDS -----------------------------------------------------
    acat=[]; rows=[]
    for i,nm in enumerate(["Achievement","Attendance","Skill"]):
        aid=g.nid("AwardCategory"); acat.append(aid); rows.append([str(aid),q(nm),str(i+1)])
    g.insert("AwardCategory",["id","name","colour"],rows)
    agrp=[]; rows=[]
    for i in range(3):
        ag=g.nid("AwardGroup"); agrp.append(ag)
        rows.append([str(ag),q(f"Award Set {i+1}"),q("group"),str(r.choice([gr['id'] for gr in groups])),"1",str(i),q("Congratulations!")])
    g.insert("AwardGroup",["id","name","assocType","assocID","type","order","emailContent"],rows)
    awards=[]; rows=[]
    for ag in agrp:
        for j in range(r.randint(2,4)):
            aw=g.nid("Award"); awards.append(aw)
            rows.append([str(aw),q(f"Badge {aw}"),str(ag),n(r.choice(acat)),q("Awarded for excellence"),str(j)])
    g.insert("Award",["id","name","awardGroupID","awardCategoryID","description","order"],rows)
    rows=[]; agp=set()
    for ag in agrp:
        for pid in r.sample(members,min(len(members),15)):
            if (ag,pid) in agp: continue
            agp.add((ag,pid)); rows.append([str(ag),str(pid),"2",dd(dt.date(2025,6,r.randint(1,28)))])
    g.insert("AwardGroupPerson",["awardGroupID","personID","status","dateCompleted"],rows)
    rows=[]
    for aw in awards:
        for pid in r.sample(members,r.randint(3,8)):
            rows.append([str(g.nid("AwardPerson")),str(aw),str(pid),dd(dt.date(2025,r.randint(3,11),r.randint(1,28))),n(r.choice(coaches)),q("Well earned")])
    g.insert("AwardPerson",["id","awardID","personID","date","awardedByID","notes"],rows)

    # ---- 12. ASSETS -----------------------------------------------------
    assets=[]; rows=[]
    anames=[("Club Uniform",1),("Competition Leotard",1),("Grip Bag",0),("Locker",2)]
    for i,(nm,merch) in enumerate(anames):
        aid=g.nid("Asset"); assets.append(aid)
        rows.append([str(aid),q(nm),q("Size"),"1",str(merch),"1",str(r.randint(20,100)),str(r.choice([1,2])),
            money(r.choice([0,5,10])),money(r.choice([25,45,60])),q(""),str(i)])
    g.insert("Asset",["id","name","optionText","showRegistration","merchandise","customise","qty","purchaseType","priceRent","pricePurchase","notes","order"],rows)
    aopt=[]; rows=[]
    for aid in assets:
        for i,sz in enumerate(["S","M","L"]):
            oid=g.nid("AssetOption"); aopt.append((oid,aid))
            rows.append([str(oid),str(aid),q(sz),str(r.randint(5,30)),money(r.choice([25,45])),str(i)])
    g.insert("AssetOption",["id","assetID","name","qty","price","order"],rows)
    rows=[[str(aid),str(r.choice([gr['id'] for gr in groups]))] for aid in assets]
    g.insert("AssetGroup",["assetID","groupID"],rows)
    rows=[]
    for aid in assets:
        opts=[o for o in aopt if o[1]==aid]
        for pid in r.sample(members,r.randint(10,25)):
            oid=r.choice(opts)[0] if opts else None
            rows.append([str(g.nid("AssetPerson")),str(aid),n(oid),str(pid),"1",n(r.choice([t[0] for t in terms])),
                q("2025-02-15 10:00:00"),n(r.choice(coaches)),q("0000-00-00 00:00:00"),"NULL",q(""),q(f"#{r.randint(100,999)}")])
    g.insert("AssetPerson",["id","assetID","assetOptionID","personID","purchaseType","termID","issueDate","issuedByID","returnDate","returnedByID","note","identifier"],rows)

    # ---- 13. RESOURCES --------------------------------------------------
    res=[]; rows=[]
    for i,nm in enumerate(["Code of Conduct","Term Newsletter","Uniform Guide","Coaching Manual"]):
        rid=g.nid("Resource"); res.append(rid)
        rows.append([str(rid),q(nm),str(r.choice([1,2])),q(f"/files/{nm.lower().replace(' ','-')}.pdf"),q(""),q("Club document"),dd(dt.date(2025,1,15)),"NULL"])
    g.insert("Resource",["id","name","type","data","preview","description","startDate","endDate"],rows)
    rcat=[]; rows=[]
    for i,nm in enumerate(["Policies","Newsletters","Guides"]):
        rc=g.nid("ResourceCategory"); rcat.append(rc); rows.append([str(rc),q(nm),q("group"),n(r.choice(codes))])
    g.insert("ResourceCategory",["id","name","assocType","codeID"],rows)
    rows=[[str(rc),str(r.choice([gr['id'] for gr in groups]))] for rc in rcat]
    g.insert("ResourceCategoryGroup",["resourceCategoryID","groupID"],rows)
    rows=[[str(rid),str(r.choice(rcat))] for rid in res]
    g.insert("ResourceCategoryLink",["resourceID","resourceCategoryID"],rows)
    rows=[]; rp=set()
    for rid in res:
        for pid in r.sample(members,r.randint(20,60)):
            if (rid,pid) in rp: continue
            rp.add((rid,pid)); rows.append([str(rid),str(pid)])
    g.insert("ResourcePerson",["resourceID","personID"],rows)

    # ---- 14. EVENTS -----------------------------------------------------
    ecat=[]; rows=[]
    for i,(nm,col) in enumerate([("Training","#1E90FF"),("Competition","#E4572E"),("Social","#17A398")]):
        ec=g.nid("EventCategory"); ecat.append(ec); rows.append([str(ec),q(nm),q(col),"0",str(r.choice([1,2]))])
    g.insert("EventCategory",["id","name","colour","selected","eventType"],rows)
    events=[]; rows=[]
    span0=terms[0][2]; span1=terms[-1][3]; spandays=(span1-span0).days
    for i in range(60):
        ev=g.nid("Event"); dte=span0+dt.timedelta(days=r.randint(0,spandays)); gr=r.choice(groups)
        events.append((ev,gr["id"]))
        rows.append([str(ev),n(r.choice(coaches)),str(r.choice([1,2,3])),q(f"{r.choice(['Training','Match','Display','Meet'])} {ev}"),
            q("Club venue"),n(r.choice(venues)),dd(dte),"'16:00:00'",dd(dte),"'18:00:00'",money(r.choice([0,0,5,10])),dd(dte),
            "''","NULL",n(r.choice(programs) if r.random()<0.2 else None),str(r.choice([0,30,50])),dd(dte-dt.timedelta(days=3)),"''","0"])
    g.insert("Event",["id","personID","type","name","location","venueID","date","startTime","endDate","endTime","fee","feeDue","notes","awardID","programID","maxAttendees","closeDate","terms","notifications"],rows)
    rows=[[str(ev),str(r.choice(ecat))] for (ev,_) in events]
    g.insert("EventCategoryLink",["eventID","eventCategoryID"],rows)
    rows=[]; eg=set()
    for (ev,gid) in events:
        if (ev,gid) not in eg: eg.add((ev,gid)); rows.append([str(ev),str(gid)])
    g.insert("EventGroup",["eventID","groupID"],rows)
    rows=[]
    for (ev,gid) in events:
        att=list({m for (m,gg,tt) in memb if gg==gid})
        for pid in r.sample(att,min(len(att),r.randint(4,12))) if att else []:
            si=r.random()<0.7
            rows.append([str(g.nid("EventPerson")),"1",str(ev),str(pid),"1","0","''","''",
                n(r.choice(coaches)) if si else "NULL","NULL",q("2025-06-01 16:00:00") if si else "NULL","NULL"])
    g.insert("EventPerson",["id","status","eventID","personID","type","hours","name","note","signedinID","signedoutID","signedInTime","signedOutTime"],rows)
    rows=[[str(ev),q(r.choice(["home","away","gala","term1"]))] for (ev,_) in r.sample(events,min(len(events),20))]
    g.insert("EventTag",["eventID","tag"],rows)

    # ---- 15. REG FORMS --------------------------------------------------
    regtabs=[]; rows=[]
    for i,(nm,typ) in enumerate([("Player details","player"),("Parent details","parent"),("Emergency contact","ec")]):
        rt=g.nid("RegTab"); regtabs.append(rt)
        rows.append([str(rt),q(nm),q(typ),q(nm.split()[0]),"1",str(r.choice([1,4])),q("Please complete"),q('[]'),str(r.choice([0,1]))])
    g.insert("RegTab",["id","name","type","singular","min","max","intro","fields","showEC"],rows)
    regforms=[]; rows=[]
    for i in range(2):
        rf=g.nid("RegForm"); regforms.append(rf)
        rows.append([str(rf),q(f"{'Term' if i==0 else 'Holiday'} Registration"),q("Sign up now"),q("term"),
            str(regtabs[0]),str(regtabs[1]),q("player"),"0",n(r.choice(codes)),"1","0","''","''","''","''",str(i),"NULL"])
    g.insert("RegForm",["id","name","subtitle","type","regTab1ID","regTab2ID","primary","termset","billingCodeID","concessions","vaccinePass","assetsText","termsText","summaryText","successText","order","tileColour"],rows)
    rows=[]; rfc=set()
    for rf in regforms:
        for c in r.sample(leaf,3):
            if (rf,c) not in rfc: rfc.add((rf,c)); rows.append([str(rf),str(c)])
    g.insert("RegFormCode",["regFormID","codeID"],rows)

    # ---- 16. SPONSORS / VOUCHERS ---------------------------------------
    rows=[[str(g.nid("Sponsor")),q(nm),q("09 555 0000"),q(f"info@{nm.lower().replace(' ','')}.co.nz"),q(f"https://{nm.lower().replace(' ','')}.co.nz"),str(i)]
          for i,nm in enumerate(["Bay Motors","Fresh Foods","City Physio","North Bank"])]
    g.insert("Sponsor",["id","name","phone","email","website","order"],rows)
    rows=[[str(g.nid("Voucher")),q(f"Gift Voucher {i+1}"),money(r.choice([20,50,100])),dd(dt.date(2026,6,30)),q(f"GV{r.randint(1000,9999)}")] for i in range(6)]
    g.insert("Voucher",["id","name","amount","expiry","code"],rows)

    # ---- 17. EMAIL / IMAGE / SETTINGS / LOG / LoginAttempts / XeroError -
    rows=[]
    for i in range(15):
        rows.append([str(g.nid("Email")),q(f"Club update {i+1}"),q("<p>Hello members,</p>"),n(r.choice(coaches)),q("all members"),"1","NULL"])
    g.insert("Email",["id","subject","message","personID","recipients","subscribers","transmissionID"],rows)
    rows=[[str(g.nid("Image")),q(r.choice(["logo","banner","gallery"])),"800","600",q("jpg"),str(r.choice([gr['id'] for gr in groups]))] for _ in range(12)]
    g.insert("Image",["id","label","width","height","ext","assocID"],rows)
    setts=[("clubName",cfg["slug"].title()+" Club"),("currency","NZD"),("locale","en-NZ"),("season","2025"),("timezone","Pacific/Auckland")]
    g.insert("Settings",["key","value"],[[q(k),q(v)] for k,v in setts])
    g.insert("Settings2",["key","value"],[[q("terminology"),q('{"member":"Gymnast","group":"Class"}')],[q("theme"),q('{"primary":"#1E2157"}')]])
    rows=[[str(g.nid("Log")),n(r.choice(coaches)),q("127.0.0.1"),q(r.choice(["Person","Group","Fee"])),str(r.randint(1,100)),q('{"action":"update"}')] for _ in range(20)]
    g.insert("Log",["id","userID","ip","table","rowID","data"],rows)
    g.insert("LoginAttempts",["ip","username","attempts"],[[q(f"10.0.0.{i}"),q(f"user{i}@x.com"),str(r.randint(1,3))] for i in range(1,6)])
    rows=[[str(g.nid("XeroError")),"1",q("Fee"),str(r.randint(1,50)),q("create"),q("Invoices"),q("Contact not found")] for _ in range(4)]
    g.insert("XeroError",["id","status","assocType","assocID","action","endpoint","message"],rows)

    # ================= 18. COMPETITIONS =================================
    # NB: `CompClub` is a VIEW (not a base table) -> never inserted. A comp "club"
    # is represented by a Person id (compClubID FKs reference Person).
    g.insert("CompCertificate",["id","name","layout"],[[str(g.nid("CompCertificate")),q(f"Certificate {i+1}"),q("A4-landscape")] for i in range(2)])
    g.insert("CompClubRole",["name","minimum"],[[q(nm),str(mn)] for nm,mn in [("Manager",1),("Coach",1),("Umpire",2)]])
    cevents=[]; rows=[]
    for i,nm in enumerate(["Vault","Bars","Beam","Floor"]):
        ce=g.nid("CompEvent"); cevents.append(ce); rows.append([str(ce),q(nm),str(r.choice([60,90,120])),str(i),"1","0",str(r.randint(1,4))])
    g.insert("CompEvent",["id","name","time","order","passes","isTeam","compSessionSportID"],rows)

    allteam_persons = members
    # comp-club person links + roles (club-level, no comp column -> seed ONCE)
    ccp=set(); cprows=[]; crrows=[]
    for rep in clubreps:
        for pid in r.sample(members,3):
            if (pid,rep) in ccp: continue
            ccp.add((pid,rep)); cprows.append([str(pid),str(rep)])
        crrows.append([str(rep),str(rep),q(r.choice(["Manager","Coach"]))])
    g.insert("CompClubPerson",["personID","compClubID"],cprows)
    g.insert("CompClubPersonRole",["personID","compClubID","name"],crrows)
    for ci in range(NC):
        comp=g.nid("Comp"); cs=dt.date(2025,r.choice([3,6,9]),1)
        g.insert("Comp",["id","name","compSportID","start","end","signupOpen","signupClosed","playerCutoff","exclCutoff",
            "needUmpire","registerPool","playerNotify","publicRegister","playerRegTabID","officialRegTabID","teamFields",
            "maxClubTeams","entryRequirement","requiredStaffPositions","personHelpText"],
            [[str(comp),q(f"{cfg['slug'].title()} Championship {ci+1}"),str(r.randint(1,4)),dd(cs),dd(cs+dt.timedelta(days=60)),
              dd(cs-dt.timedelta(days=40)),dd(cs-dt.timedelta(days=10)),dd(cs),dd(cs),"1","0","1","1",
              str(regtabs[0]),str(regtabs[2]),q("[]"),"4",q(""),q("Manager,Coach"),q("")]])
        # divisions
        divs=[]
        drows=[]
        for di in range(r.randint(2,3)):
            d=g.nid("CompDivision"); divs.append(d)
            drows.append([str(d),str(r.choice([0,1])),q(f"Division {di+1}"),str(comp),q("standard"),money(r.choice([40,60,80])),
                money(10),dd(cs),"4","8","2",str(r.choice([6,8])),str(r.choice([14,18])),dd(cs),str(r.choice((0,1,2))),q("Medals"),
                "5","12","0","0","0","0",str(di),"''","''","1","0","7","5","3"])
        g.insert("CompDivision",["id","type","name","compID","scoreSheet","fee","umpireFee","feeDue","minTeams","maxTeams",
            "maxClubTeams","minAge","maxAge","ageCutoff","gender","awards","playerMin","playerMax","minMales","maxMales",
            "minFemales","maxFemales","order","rules","info","scoreEntry","ringIns","gamePlayers","gameReserves","placings"],drows)
        # duties
        g.insert("CompDuty",["id","name","compDivisionID","type","order"],
            [[str(g.nid("CompDuty")),q(nm),str(r.choice(divs)),str(t),str(i)] for i,(nm,t) in enumerate([("Scorer",1),("Umpire",1),("Setup",2)])])
        # points config
        g.insert("CompGamePoints",["compID","compDivisionID","type","value","bonus"],
            [[str(comp),str(d),q(t),n(v),n(b)] for d in divs for (t,v,b) in [("win",3,0),("draw",1,0),("loss",0,0)]])
        # game times
        g.insert("CompGameTime",["id","venueID","compDivisionID","day","time"],
            [[str(g.nid("CompGameTime")),str(r.choice(venues)),str(d),str(r.randint(1,7)),"'09:00:00'"] for d in divs])
        # teams (per division) with players
        teams=[]; trows=[]; dtrows=[]; tprows=[]; psrows=[]
        for d in divs:
            for ti in range(r.randint(3,5)):
                tm=g.nid("CompTeam"); teams.append((tm,d)); rep=r.choice(clubreps)
                trows.append([str(tm),q(f"Team {tm}"),n(rep)])
                dtrows.append([str(tm),str(d),"1","1"])
                for pid in r.sample(allteam_persons,r.randint(6,9)):
                    tp=g.nid("CompTeamPerson")
                    tprows.append([str(tp),str(tm),str(pid),str(comp),str(r.choice([1,1,2])),q(r.choice(["","Captain","Vice"])),"0"])
                    psrows.append([str(tp),str(r.randint(1,4))])
        g.insert("CompTeam",["id","name","compClubID"],trows)
        g.insert("CompDivisionTeam",["compTeamID","compDivisionID","approved","requireUmpire"],dtrows)
        g.insert("CompTeamPerson",["id","compTeamID","personID","compID","role","position","special"],tprows)
        g.insert("CompPersonSport",["compTeamPersonID","compSportID"],psrows)
        # rounds -> pools -> games
        rounds=[]; rrows=[]
        for d in divs:
            for ri in range(2):
                rd=g.nid("CompRound"); rounds.append((rd,d))
                rrows.append([str(rd),q(f"Round {ri+1}"),str(d),str(r.choice([0,1])),"NULL",dd(cs),dd(cs+dt.timedelta(days=30)),"1",str(ri)])
        g.insert("CompRound",["id","name","compDivisionID","type","parentID","publishFrom","publishTo","publishOptions","order"],rrows)
        pools=[]; prows=[]
        for (rd,d) in rounds:
            pool=g.nid("CompPool"); pools.append((pool,d)); prows.append([str(pool),q(f"Pool {pool}"),str(rd)])
        g.insert("CompPool",["id","name","compRoundID"],prows)
        ptrows=[]
        for (pool,d) in pools:
            dteams=[t for (t,dd_) in teams if dd_==d]
            for i,t in enumerate(r.sample(dteams,min(len(dteams),4)) if dteams else []):
                ptrows.append([str(pool),str(t),str(i)])
        g.insert("CompPoolTeam",["compPoolID","compTeamID","order"],ptrows)
        # games (round robin-ish within division)
        games=[]; grows=[]
        for (rd,d) in rounds:
            dteams=[t for (t,dd_) in teams if dd_==d]
            r.shuffle(dteams)
            for i in range(0,len(dteams)-1,2):
                gm=g.nid("CompGame"); h,a=dteams[i],dteams[i+1]; games.append((gm,d,h,a))
                hs,as_=r.randint(0,40),r.randint(0,40)
                grows.append([str(gm),"1",str(rd),"NULL",str(h),str(a),"NULL","NULL",str(hs),str(as_),
                    "3" if hs>as_ else "0","3" if as_>hs else "0","0","0","NULL","NULL","NULL","NULL","0","0",
                    q(f"Game {gm}"),"''","0","0",q("")])
        g.insert("CompGame",["id","type","compRoundID","eventID","homeID","awayID","homeTeamPlaceID","awayTeamPlaceID",
            "homeScore","awayScore","homePoints","awayPoints","homeBonus","awayBonus","homeGameID","awayGameID",
            "homePoolID","awayPoolID","homeRank","awayRank","name","note","playoffs","placement","groupName"],grows)
        # team places (standings) referencing pools
        tprows2=[]
        for (pool,d) in pools:
            dteams=[t for (t,dd_) in teams if dd_==d]
            for i,t in enumerate(r.sample(dteams,min(len(dteams),4)) if dteams else []):
                tprows2.append([str(g.nid("CompTeamPlace")),str(pool),str(t),str(i),"NULL",str(i+1),str(i+1),"NULL","NULL"])
        g.insert("CompTeamPlace",["id","compPoolID","compTeamID","order","placePoolID","placement","rank","placeGameID","tempGameID"],tprows2)
        # game officials + game persons + stats
        gofr=[]; gpr=[]; gsr=[]
        for (gm,d,h,a) in games:
            gofr.append([str(g.nid("CompGameOfficial")),str(gm),n(r.choice(coaches)),"NULL",q("Umpire"),"1"])
            for team in (h,a):
                tp_players=[r_[2] for r_ in [] ]  # placeholder
                for pid in r.sample(allteam_persons,r.randint(5,7)):
                    gpr.append([str(g.nid("CompGamePerson")),"1",str(gm),str(team),str(pid),str(r.randint(1,20)),q(r.choice(["GK","DEF","MID","FWD"])),"0","''","0"])
            for stype in ["goals","fouls"]:
                gsr.append([str(gm),q(stype),"1",str(r.randint(0,10)),str(r.randint(0,10))])
        g.insert("CompGameOfficial",["id","compGameID","personID","compTeamID","duty","type"],gofr)
        g.insert("CompGamePerson",["id","status","compGameID","compTeamID","personID","shirtNo","position","order","note","special"],gpr)
        g.insert("CompGameStats",["compGameID","type","num","home","away"],gsr)
        # team conflicts / exclusions / custom field team
        cfrows=[]; exrows=[]; cftrows=[]
        for d in divs:
            dteams=[t for (t,dd_) in teams if dd_==d]
            if len(dteams)>=2:
                cfrows.append([str(g.nid("CompTeamConflict")),str(dteams[0]),str(comp),str(dteams[1]),q("Shared players"),q("Do not schedule together")])
            for t in dteams[:2]:
                exrows.append([str(g.nid("CompTeamExclusion")),str(t),str(comp),dd(cs),str(r.randint(1,7)),"'09:00:00'","'12:00:00'",q("Unavailable"),q("Away")])
                cftrows.append([q(cfids[0][1]),str(t),str(comp),q("None")])
        g.insert("CompTeamConflict",["id","compTeamID","compID","conflictTeamID","reason","message"],cfrows)
        g.insert("CompTeamExclusion",["id","compTeamID","compID","date","day","startTime","endTime","reason","message"],exrows)
        g.insert("CustomFieldTeam",["field","compTeamID","compID","value"],cftrows)
        # sessions -> groups -> events -> officials -> participants -> schedule -> score -> team
        sessions=[]; srows=[]
        for si in range(2):
            se=g.nid("CompSession"); sessions.append(se)
            srows.append([str(se),str(comp),q(f"Session {si+1}"),str(r.randint(1,4)),str(r.choice((0,1,2))),"60","5","18",dd(cs),"0","4","0","0","0","4","0",
                dd(cs),"'09:00:00'","1","1",dd(cs),"'09:00:00'",money(30),dd(cs),str(si)])
        g.insert("CompSession",["id","compID","name","sessionSportID","gender","maxParticipants","minAge","maxAge","ageCutoff",
            "allowDoubles","clubLimit","startingScore","teamEvent","groupSize","clubMaxGroups","levels","date","startTime",
            "divisions","publishWebsite","publishDate","publishTime","fee","feeDue","order"],srows)
        cgroups=[]; cgrows=[]; serows=[]; sofr=[]; sprows=[]
        for se in sessions:
            for gi in range(2):
                cg=g.nid("CompGroup"); cgroups.append((cg,se)); cgrows.append([str(cg),q(f"Group {cg}"),str(se),str(gi)])
            for ce in r.sample(cevents,2):
                serows.append([str(g.nid("CompSessionEvent")),str(se),str(ce),"1","1"])
                sofr.append([str(g.nid("CompSessionOfficial")),n(r.choice(coaches)),str(se),q("Judge"),str(ce),"1",str(0)])
        g.insert("CompGroup",["id","name","compSessionID","order"],cgrows)
        g.insert("CompSessionEvent",["id","compSessionID","compEventID","publishInternally","publishWebsite"],serows)
        g.insert("CompSessionOfficial",["id","personID","compSessionID","title","compEventID","type","order"],sofr)
        parts=[]; sprows=[]; pseen=set()
        for (cg,se) in cgroups:
            for pid in r.sample(members,r.randint(4,6)):
                if (se,pid) in pseen: continue
                pseen.add((se,pid))
                p=g.nid("CompSessionParticipant"); parts.append((p,cg,se))
                sprows.append([str(p),str(cg),str(se),str(pid),"NULL",n(r.choice(clubreps)),q("L3"),q("Div1"),"0"])
        g.insert("CompSessionParticipant",["id","compGroupID","compSessionID","personID","compTeamID","compClubID","level","division","order"],sprows)
        schedrows=[]; scheds=[]
        for (p,cg,se) in parts:
            ce=r.choice(cevents); sc=g.nid("CompSessionSchedule"); scheds.append(sc)
            schedrows.append([str(sc),str(p),str(cg),str(ce),"1","1","1"])
        g.insert("CompSessionSchedule",["id","compSessionParticipantID","compGroupID","compEventID","eventOrder","participantOrder","pass"],schedrows)
        # a session official per session for scores
        sess_off = {}
        # reuse CompSessionOfficial ids: query not available, so create score rows referencing existing sofr ids
        off_ids = [row[0] for row in sofr]
        scorerows=[]
        for sc in scheds:
            if off_ids:
                scorerows.append([str(g.nid("CompSessionScore")),str(sc),str(r.choice(off_ids)),money(r.uniform(6,10)),"1"])
        g.insert("CompSessionScore",["id","compSessionScheduleID","compSessionOfficialID","score","pass"],scorerows)
        strows=[]
        for (tm,d) in teams:
            for se in sessions:
                if r.random()<0.4: strows.append([str(tm),str(se),"1",str(r.randint(4,8))])
        g.insert("CompSessionTeam",["compTeamID","compSessionID","approved","participants"],strows)

    # ================= assemble =========================================
    header=["-- FriendlyManager FULL legacy club seed (generated)",
            f"-- club={cfg['slug']} seed={cfg['seed']} persons={NP} groups={NG} comps={NC}",
            "SET FOREIGN_KEY_CHECKS=0;","SET @OLD=@@SQL_MODE; SET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';",""]
    # own the DB: truncate every table we populate (clears the dump's pre-seed rows)
    truncs=[f"TRUNCATE TABLE `{t}`;" for t in g.counts.keys()]
    footer=["","SET FOREIGN_KEY_CHECKS=1;","SET SQL_MODE=@OLD;",""]
    sql="\n".join(header)+"\n".join(truncs)+"\n"+"\n".join(g.buf)+"\n".join(footer)
    stats={"invoiced":inv,"paid":paid,"outstanding":inv-paid}
    return sql, g.counts, stats

# ================================================================== main
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--slug",default="demo"); ap.add_argument("--persons",type=int,default=1000)
    ap.add_argument("--groups",type=int,default=100); ap.add_argument("--comps",type=int,default=2)
    ap.add_argument("--seed",type=int,default=42); ap.add_argument("--out",default="out")
    a=ap.parse_args()
    cfg={"slug":a.slug,"persons":a.persons,"groups":a.groups,"comps":a.comps,"seed":a.seed}
    sql,counts,stats=build(cfg)
    os.makedirs(a.out,exist_ok=True)
    path=os.path.join(a.out,f"{a.slug}.sql")
    open(path,"w").write(sql)
    empty=[t for t,c in counts.items() if c==0]
    print(f"club={a.slug}: {len(counts)} tables populated, {sum(counts.values()):,} rows -> {path}")
    print(f"  invoiced ${stats['invoiced']:,.2f}  paid ${stats['paid']:,.2f}  outstanding ${stats['outstanding']:,.2f}")
    if empty: print(f"  EMPTY TABLES: {empty}")

if __name__=="__main__": main()
