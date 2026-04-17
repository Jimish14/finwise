# """
# =============================================================
#   SMART TRANSACTION CATEGORIZER
# =============================================================
#   Model   : TF-IDF Vectorizer + Logistic Regression
#   Input   : description, merchant_name, amount, mode
#   Output  : predicted category + confidence score

#   How it works:
#     1. Preprocess raw text (description + merchant_name)
#     2. Convert to TF-IDF feature vector
#     3. Logistic Regression classifies the category
#     4. If confidence is low, fall back to rule-based engine
# =============================================================
# """

# import re
# import pickle
# import os
# import numpy as np
# from sklearn.feature_extraction.text import TfidfVectorizer
# from sklearn.linear_model import LogisticRegression
# from sklearn.pipeline import Pipeline
# from sklearn.preprocessing import LabelEncoder
# from sklearn.model_selection import train_test_split
# from sklearn.metrics import classification_report

# # ─────────────────────────────────────────────
# #  CATEGORY DEFINITIONS & KEYWORD RULES
# # ─────────────────────────────────────────────
# CATEGORY_KEYWORDS = {
#     "Food": [
#         "swiggy", "zomato", "restaurant", "cafe", "coffee", "pizza", "burger",
#         "biryani", "food", "dining", "lunch", "dinner", "breakfast", "meal",
#         "grocery", "bakery", "chai", "tea", "juice", "dominos", "kfc", "mcdonalds",
#         "subway", "starbucks", "barbeque", "hotel", "dhaba"
#     ],
#     "Transport": [
#         "uber", "ola", "rapido", "auto", "cab", "taxi", "bus", "metro", "train",
#         "irctc", "petrol", "fuel", "diesel", "parking", "toll", "flight", "indigo",
#         "spicejet", "airindia", "redbus", "makemytrip", "goibibo"
#     ],
#     "Shopping": [
#         "amazon", "flipkart", "myntra", "meesho", "ajio", "nykaa", "snapdeal",
#         "mall", "shopping", "clothes", "shirt", "shoes", "watch", "bag", "jewellery",
#         "fashion", "dress", "online", "delivery", "order"
#     ],
#     "Bills": [
#         "electricity", "water", "gas", "internet", "broadband", "wifi", "mobile",
#         "recharge", "postpaid", "prepaid", "jio", "airtel", "bsnl", "vi",
#         "bill", "utility", "dth", "tata sky", "dish tv"
#     ],
#     "Entertainment": [
#         "netflix", "prime", "hotstar", "spotify", "youtube", "movie", "cinema",
#         "pvr", "inox", "concert", "event", "game", "gaming", "playstation",
#         "steam", "subscription", "ott", "music"
#     ],
#     "Health": [
#         "hospital", "clinic", "doctor", "medicine", "pharmacy", "medplus",
#         "apollo", "diagnostic", "lab", "test", "health", "gym", "fitness",
#         "wellness", "dental", "eye", "insurance", "mediclaim"
#     ],
#     "Education": [
#         "school", "college", "university", "course", "udemy", "coursera",
#         "books", "stationery", "tuition", "coaching", "exam", "fee",
#         "study", "learning", "training", "certification"
#     ],
#     "Investment": [
#         "sip", "mutual fund", "stocks", "shares", "zerodha", "groww", "upstox",
#         "fd", "fixed deposit", "ppf", "nps", "gold", "crypto", "bitcoin",
#         "investment", "portfolio", "dividend", "interest"
#     ],
#     "Rent": [
#         "rent", "landlord", "house", "flat", "apartment", "pg", "hostel",
#         "accommodation", "maintenance", "society", "housing"
#     ],
#     "Transfer": [
#         "transfer", "sent to", "received from", "upi", "neft", "rtgs",
#         "imps", "wallet", "paytm", "phonepe", "gpay", "google pay",
#         "bhim", "bank transfer"
#     ],
#     "Salary": [
#         "salary", "payroll", "wages", "stipend", "income", "credited",
#         "employer", "company", "payment received"
#     ],
#     "Travel": [
#         "hotel", "resort", "booking", "oyo", "trip", "vacation",
#         "tour", "holiday", "airbnb", "passport", "visa", "travel"
#     ],
#     "Miscellaneous": []
# }


# # ─────────────────────────────────────────────
# #  TEXT PREPROCESSING
# # ─────────────────────────────────────────────
# def preprocess_text(text: str) -> str:
#     """Normalize and clean transaction text."""
#     if not text:
#         return ""
#     text = text.lower()
#     text = re.sub(r"[^a-z0-9\s]", " ", text)       # keep alphanumeric
#     text = re.sub(r"\b\d+\b", " NUM ", text)         # replace standalone numbers
#     text = re.sub(r"\s+", " ", text).strip()
#     return text


# def build_combined_text(description: str, merchant_name: str = "") -> str:
#     """Combine description and merchant name for richer context."""
#     parts = []
#     if merchant_name:
#         parts.append(merchant_name)
#     if description:
#         parts.append(description)
#     return preprocess_text(" ".join(parts))


# # ─────────────────────────────────────────────
# #  RULE-BASED FALLBACK ENGINE
# # ─────────────────────────────────────────────
# def rule_based_category(text: str) -> tuple[str, float]:
#     """
#     Keyword matching fallback.
#     Returns (category, confidence_score).
#     """
#     text_lower = text.lower()
#     for category, keywords in CATEGORY_KEYWORDS.items():
#         for kw in keywords:
#             if kw in text_lower:
#                 return category, 0.70   # moderate confidence for rule-based

#     return "Miscellaneous", 0.40


# # ─────────────────────────────────────────────
# #  TRAINING DATA GENERATOR
# # ─────────────────────────────────────────────
# TRAINING_SAMPLES = [
#     # Food
#     ("Swiggy order biryani", "Swiggy", "Food"),
#     ("Zomato pizza delivery", "Zomato", "Food"),
#     ("lunch at restaurant", "Restaurant", "Food"),
#     ("coffee at starbucks", "Starbucks", "Food"),
#     ("grocery shopping bigbasket", "BigBasket", "Food"),
#     ("kfc chicken burger meal", "KFC", "Food"),
#     ("dominos pizza order", "Dominos", "Food"),
#     ("daily chai from tapri", "", "Food"),

#     # Transport
#     ("Ola cab to airport", "Ola", "Transport"),
#     ("Uber ride office", "Uber", "Transport"),
#     ("petrol bunk refill", "BPCL", "Transport"),
#     ("metro card recharge", "DMRC", "Transport"),
#     ("IRCTC train ticket booking", "IRCTC", "Transport"),
#     ("bus pass monthly", "", "Transport"),
#     ("rapido bike ride", "Rapido", "Transport"),
#     ("toll plaza payment", "", "Transport"),

#     # Shopping
#     ("Amazon order earphones", "Amazon", "Shopping"),
#     ("Flipkart mobile phone", "Flipkart", "Shopping"),
#     ("Myntra dress purchase", "Myntra", "Shopping"),
#     ("online clothes shopping", "Meesho", "Shopping"),
#     ("mall shopping weekend", "", "Shopping"),
#     ("Nykaa cosmetics order", "Nykaa", "Shopping"),

#     # Bills
#     ("electricity bill payment", "BESCOM", "Bills"),
#     ("Jio broadband internet bill", "Jio", "Bills"),
#     ("Airtel postpaid bill", "Airtel", "Bills"),
#     ("water bill municipality", "", "Bills"),
#     ("DTH Tata Sky recharge", "Tata Sky", "Bills"),
#     ("gas cylinder booking", "IndianGas", "Bills"),

#     # Entertainment
#     ("Netflix subscription monthly", "Netflix", "Entertainment"),
#     ("Spotify premium music", "Spotify", "Entertainment"),
#     ("PVR cinema ticket movie", "PVR", "Entertainment"),
#     ("Amazon Prime renewal", "Amazon Prime", "Entertainment"),
#     ("gaming steam purchase", "Steam", "Entertainment"),
#     ("Hotstar Disney subscription", "Hotstar", "Entertainment"),

#     # Health
#     ("Apollo pharmacy medicine", "Apollo Pharmacy", "Health"),
#     ("doctor consultation fee", "", "Health"),
#     ("gym membership monthly", "Cult.fit", "Health"),
#     ("diagnostic lab test", "Thyrocare", "Health"),
#     ("health insurance premium", "Star Health", "Health"),
#     ("dental checkup clinic", "", "Health"),

#     # Education
#     ("Udemy course purchase", "Udemy", "Education"),
#     ("college tuition fee", "", "Education"),
#     ("books stationery purchase", "", "Education"),
#     ("Coursera subscription", "Coursera", "Education"),
#     ("school fee monthly", "", "Education"),

#     # Investment
#     ("SIP mutual fund Groww", "Groww", "Investment"),
#     ("Zerodha stocks purchase", "Zerodha", "Investment"),
#     ("FD fixed deposit renewal", "", "Investment"),
#     ("PPF annual contribution", "", "Investment"),
#     ("gold purchase investment", "", "Investment"),

#     # Rent
#     ("house rent payment landlord", "", "Rent"),
#     ("PG accommodation monthly", "", "Rent"),
#     ("flat rent transfer", "", "Rent"),
#     ("society maintenance charge", "", "Rent"),

#     # Transfer
#     ("UPI transfer friend", "", "Transfer"),
#     ("sent money to family", "", "Transfer"),
#     ("bank NEFT transfer", "", "Transfer"),
#     ("PhonePe wallet topup", "PhonePe", "Transfer"),
#     ("Google Pay payment", "GPay", "Transfer"),

#     # Salary
#     ("salary credited account", "", "Salary"),
#     ("monthly salary payment", "", "Salary"),
#     ("freelance payment received", "", "Salary"),
#     ("stipend credited", "", "Salary"),

#     # Travel
#     ("OYO hotel booking", "OYO", "Travel"),
#     ("MakeMyTrip flight hotel", "MakeMyTrip", "Travel"),
#     ("vacation trip package", "", "Travel"),
#     ("Airbnb accommodation booking", "Airbnb", "Travel"),
#     ("holiday resort booking", "", "Travel"),
# ]


# # ─────────────────────────────────────────────
# #  MAIN MODEL CLASS
# # ─────────────────────────────────────────────
# class TransactionCategorizer:
#     """
#     ML-powered transaction categorizer with rule-based fallback.

#     Architecture:
#       TF-IDF (char + word n-grams) → Logistic Regression
#       Confidence threshold → fallback to keyword rules
#     """

#     MODEL_PATH = os.path.join(os.path.dirname(__file__), "categorizer_model.pkl")
#     CONFIDENCE_THRESHOLD = 0.55

#     def __init__(self):
#         self.pipeline = None
#         self.label_encoder = LabelEncoder()
#         self.is_trained = False

#     def _build_pipeline(self) -> Pipeline:
#         """Build sklearn pipeline: TF-IDF + Logistic Regression."""
#         return Pipeline([
#             ("tfidf", TfidfVectorizer(
#                 analyzer="char_wb",        # character n-grams (handles typos)
#                 ngram_range=(2, 5),
#                 max_features=8000,
#                 sublinear_tf=True,
#                 min_df=1
#             )),
#             ("clf", LogisticRegression(
#                 C=5.0,
#                 max_iter=500,
#                 solver="lbfgs",
#                 class_weight="balanced"
#             ))
#         ])

#     def train(self, samples: list = None) -> dict:
#         """
#         Train model on labeled samples.
#         samples: list of (description, merchant_name, category) tuples
#         """
#         if samples is None:
#             samples = TRAINING_SAMPLES

#         # Build training data
#         X_raw = [build_combined_text(desc, merch) for desc, merch, _ in samples]
#         y_raw = [cat for _, _, cat in samples]

#         # Encode labels
#         y_encoded = self.label_encoder.fit_transform(y_raw)

#         # Split for evaluation
#         X_train, X_test, y_train, y_test = train_test_split(
#             X_raw, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
#         )

#         # Build & train pipeline
#         self.pipeline = self._build_pipeline()
#         self.pipeline.fit(X_train, y_train)
#         self.is_trained = True

#         # Evaluate
#         y_pred = self.pipeline.predict(X_test)
#         y_test_labels = self.label_encoder.inverse_transform(y_test)
#         y_pred_labels = self.label_encoder.inverse_transform(y_pred)
#         report = classification_report(y_test_labels, y_pred_labels, output_dict=True, zero_division=0)

#         # Save model
#         self.save()

#         return {
#             "status": "trained",
#             "samples_used": len(samples),
#             "accuracy": round(report.get("accuracy", 0), 3),
#             "categories": list(self.label_encoder.classes_)
#         }

#     def predict(self, description: str, merchant_name: str = "", amount: float = None) -> dict:
#         """
#         Predict category for a transaction.

#         Returns:
#             {
#               "category": str,
#               "confidence": float,
#               "method": "ml" | "rule_based",
#               "all_probabilities": dict
#             }
#         """
#         combined_text = build_combined_text(description, merchant_name)

#         # Try ML model first
#         if self.is_trained and self.pipeline and combined_text:
#             try:
#                 proba = self.pipeline.predict_proba([combined_text])[0]
#                 top_idx = int(np.argmax(proba))
#                 confidence = float(proba[top_idx])
#                 predicted_label = self.label_encoder.inverse_transform([top_idx])[0]

#                 all_proba = {
#                     cat: round(float(p), 3)
#                     for cat, p in zip(self.label_encoder.classes_, proba)
#                 }

#                 # Use ML if confidence is high enough
#                 if confidence >= self.CONFIDENCE_THRESHOLD:
#                     return {
#                         "category": predicted_label,
#                         "confidence": round(confidence, 3),
#                         "method": "ml",
#                         "all_probabilities": all_proba
#                     }

#             except Exception:
#                 pass

#         # Fallback to rule-based
#         category, confidence = rule_based_category(combined_text)

#         # Amount-based hint: large amounts often not Food
#         if amount and amount > 50000 and category == "Food":
#             category = "Investment"
#             confidence = 0.50

#         return {
#             "category": category,
#             "confidence": confidence,
#             "method": "rule_based",
#             "all_probabilities": {}
#         }

#     def add_training_sample(self, description: str, merchant_name: str, correct_category: str):
#         """
#         Add a user-corrected sample and retrain.
#         This implements online learning / feedback loop.
#         """
#         TRAINING_SAMPLES.append((description, merchant_name, correct_category))
#         return self.train(TRAINING_SAMPLES)

#     def save(self):
#         """Persist model to disk."""
#         with open(self.MODEL_PATH, "wb") as f:
#             pickle.dump({
#                 "pipeline": self.pipeline,
#                 "label_encoder": self.label_encoder
#             }, f)

#     def load(self) -> bool:
#         """Load model from disk."""
#         if os.path.exists(self.MODEL_PATH):
#             try:
#                 with open(self.MODEL_PATH, "rb") as f:
#                     data = pickle.load(f)
#                 self.pipeline = data["pipeline"]
#                 self.label_encoder = data["label_encoder"]
#                 self.is_trained = True
#                 return True
#             except Exception:
#                 pass
#         return False


# # ─────────────────────────────────────────────
# #  SINGLETON INSTANCE
# # ─────────────────────────────────────────────
# categorizer = TransactionCategorizer()
# if not categorizer.load():
#     categorizer.train()


# # ─────────────────────────────────────────────
# #  PUBLIC API FUNCTION
# # ─────────────────────────────────────────────
# def categorize_transaction(description: str, merchant_name: str = "", amount: float = None) -> dict:
#     """
#     Main entry point for transaction categorization.

#     Args:
#         description  : Transaction title / description text
#         merchant_name: Merchant or payee name
#         amount       : Transaction amount (optional, used as hint)

#     Returns:
#         {
#           "category": "Food",
#           "confidence": 0.91,
#           "method": "ml",
#           "all_probabilities": { "Food": 0.91, "Transport": 0.04, ... }
#         }
#     """
#     return categorizer.predict(description, merchant_name, amount)


# def retrain_with_feedback(description: str, merchant_name: str, correct_category: str) -> dict:
#     """
#     Accept user correction and retrain model.
#     Call this when user manually fixes a wrong category.
#     """
#     return categorizer.add_training_sample(description, merchant_name, correct_category)






# """
# =============================================================
#  SMART TRANSACTION CATEGORIZER — FINAL INDUSTRY SYSTEM 🔥
# =============================================================
# ✔ Strong dataset (realistic merchants)
# ✔ Proper supervised learning
# ✔ Hierarchical classification
# ✔ Ensemble ML (XGB + Logistic)
# ✔ Sparse optimization
# ✔ Real explainability
# ✔ Train/test evaluation
# ✔ Edge-case handling
# =============================================================
# """

# import re, os, pickle, random
# import numpy as np
# from datetime import datetime, timedelta
# from collections import Counter

# from sklearn.feature_extraction.text import TfidfVectorizer
# from sklearn.pipeline import FeatureUnion
# from sklearn.preprocessing import LabelEncoder, StandardScaler
# from sklearn.linear_model import LogisticRegression
# from sklearn.model_selection import train_test_split
# from sklearn.metrics import classification_report

# from xgboost import XGBClassifier
# from sentence_transformers import SentenceTransformer
# from scipy.sparse import hstack, csr_matrix


# # ─────────────────────────────────────────────
# # STORAGE
# # ─────────────────────────────────────────────
# PATHS = {
#     "merchant": "merchant_db.pkl",
#     "feedback": "feedback_db.pkl",
#     "user": "user_db.pkl",
#     "review": "review_queue.pkl",
#     "meta": "model_meta.pkl"
# }

# def load(path, default):
#     return pickle.load(open(path,"rb")) if os.path.exists(path) else default

# def save(path, data):
#     pickle.dump(data, open(path,"wb"))

# MERCHANT_DB = load(PATHS["merchant"], {})
# FEEDBACK_DB = load(PATHS["feedback"], [])
# USER_DB = load(PATHS["user"], {})
# REVIEW_QUEUE = load(PATHS["review"], [])
# MODEL_META = load(PATHS["meta"], {"last_trained":None,"data_size":0})

# CONF_STRONG = 0.8
# CONF_WEAK = 0.6


# # ─────────────────────────────────────────────
# # DATA AUGMENTATION
# # ─────────────────────────────────────────────
# PREFIX = ["UPI to","Paid to","Txn to","IMPS"]
# SUFFIX = ["done","success","ref","txn"]

# def augment(desc, merch):
#     data=[(desc,merch)]
#     for _ in range(5):
#         data.append((f"{random.choice(PREFIX)} {merch} {random.choice(SUFFIX)}",merch))
#     return data


# # ─────────────────────────────────────────────
# # PREPROCESS
# # ─────────────────────────────────────────────
# def preprocess(text):
#     if not text: return ""
#     text=text.lower()
#     text=re.sub(r"\d+"," ",text)
#     text=re.sub(r"[^a-z ]"," ",text)
#     return " ".join([w for w in text.split() if len(w)>2])

# def is_noise(text):
#     if len(text.split())<2: return True
#     ratio=sum(c.isalpha() for c in text)/max(len(text),1)
#     return ratio<0.4

# def extract_merch(text):
#     return " ".join(preprocess(text).split()[:2]) or "unknown"


# # ─────────────────────────────────────────────
# # MODEL
# # ─────────────────────────────────────────────
# class Categorizer:

#     def __init__(self):

#         self.embed = SentenceTransformer('all-MiniLM-L6-v2')

#         self.vec = FeatureUnion([
#             ("word", TfidfVectorizer(ngram_range=(1,2))),
#             ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(2,5)))
#         ])

#         self.scaler = StandardScaler()

#         self.enc_main = LabelEncoder()
#         self.enc_sub = LabelEncoder()

#         self.xgb = XGBClassifier(eval_metric="mlogloss")
#         self.lr = LogisticRegression(max_iter=500)
#         self.sub_model = XGBClassifier(eval_metric="mlogloss")


#     def build(self, desc, merch, amt=None):
#         txt = preprocess(f"{merch} {desc}")
#         emb = self.embed.encode(txt)
#         return txt, emb, [amt or 0]


#     def train(self):

#         base = [
#             ("swiggy order biryani","swiggy","Food","Dining"),
#             ("swiggy instamart grocery","swiggy","Food","Grocery"),
#             ("zomato delivery","zomato","Food","Dining"),
#             ("uber trip payment","uber","Transport","Taxi"),
#             ("ola cab ride","ola","Transport","Taxi"),
#             ("petrol pump hp","hp","Transport","Fuel"),
#             ("amazon electronics","amazon","Shopping","Electronics"),
#             ("flipkart mobile","flipkart","Shopping","Electronics"),
#             ("netflix subscription","netflix","Entertainment","OTT"),
#             ("spotify premium","spotify","Entertainment","Music"),
#             ("salary credited","company","Salary","Income"),
#             ("mutual fund sip groww","groww","Investment","SIP"),
#         ] + FEEDBACK_DB

#         texts, emb, num, y_main, y_sub = [], [], [], [], []

#         for d,m,mc,sc in base:
#             for ad,am in augment(d,m):
#                 t,e,n = self.build(ad,am)
#                 texts.append(t)
#                 emb.append(e)
#                 num.append(n)
#                 y_main.append(mc)
#                 y_sub.append(sc)

#         print("📊 Class Distribution:", Counter(y_main))

#         X_text = self.vec.fit_transform(texts)
#         X_num = self.scaler.fit_transform(num)

#         X = hstack([X_text, csr_matrix(np.array(emb)), csr_matrix(X_num)])

#         self.enc_main.fit(y_main)
#         self.enc_sub.fit(y_sub)

#         y_main_enc = self.enc_main.transform(y_main)
#         y_sub_enc = self.enc_sub.transform(y_sub)

#         # Train/Test split
#         X_train, X_test, y_train_m, y_test_m, y_train_s, y_test_s = train_test_split(
#             X, y_main_enc, y_sub_enc,
#             test_size=0.2, random_state=42, stratify=y_main_enc
#         )

#         # Train
#         self.xgb.fit(X_train.toarray(), y_train_m)
#         self.lr.fit(X_train, y_train_m)
#         self.sub_model.fit(X_train.toarray(), y_train_s)

#         # Evaluate
#         print("\n📊 MAIN CATEGORY REPORT")
#         y_pred = self.xgb.predict(X_test.toarray())
#         print(classification_report(
#             self.enc_main.inverse_transform(y_test_m),
#             self.enc_main.inverse_transform(y_pred)
#         ))

#         print("\n📊 SUB CATEGORY REPORT")
#         y_pred_s = self.sub_model.predict(X_test.toarray())
#         print(classification_report(
#             self.enc_sub.inverse_transform(y_test_s),
#             self.enc_sub.inverse_transform(y_pred_s)
#         ))

#         print("✅ Training complete")


#     def explain(self, X_text, px, pl):

#         try:
#             words = self.vec.transformer_list[0][1].get_feature_names_out()
#             vec = X_text.toarray()[0]
#             idx = np.argsort(vec)[-5:]
#             important = [words[i] for i in idx if i < len(words)]
#         except:
#             important = []

#         xgb_conf = float(np.max(px))
#         lr_conf = float(np.max(pl))

#         total = xgb_conf + lr_conf if xgb_conf + lr_conf else 1

#         return {
#             "important_words": important,
#             "model_contribution": {
#                 "xgb": xgb_conf/total,
#                 "lr": lr_conf/total
#             }
#         }


#     def predict(self, desc, merch="", amt=None):

#         if not desc or not desc.strip():
#             return {"category":"Unknown","reason":"empty"}

#         text = preprocess(desc)
#         if is_noise(text):
#             return {"category":"Unknown","reason":"noise"}

#         merch = merch or extract_merch(desc)

#         t,e,n = self.build(desc,merch,amt)

#         Xt = self.vec.transform([t])
#         Xn = self.scaler.transform([n])

#         X = hstack([Xt, csr_matrix(np.array([e])), csr_matrix(Xn)])

#         px = self.xgb.predict_proba(X.toarray())[0]
#         pl = self.lr.predict_proba(X)[0]

#         probs = 0.7*px + 0.3*pl
#         idx = np.argmax(probs)

#         main_cat = self.enc_main.inverse_transform([idx])[0]

#         sub_idx = self.sub_model.predict(X.toarray())[0]
#         sub_cat = self.enc_sub.inverse_transform([sub_idx])[0]

#         return {
#             "category": main_cat,
#             "subcategory": sub_cat,
#             "confidence": float(probs[idx]),
#             "explanation": self.explain(Xt, px, pl)
#         }


# # ─────────────────────────────────────────────
# # INIT
# # ─────────────────────────────────────────────
# categorizer = Categorizer()
# categorizer.train()

# def categorize_transaction(desc, merchant="", amount=None):
#     return categorizer.predict(desc, merchant, amount)




# """
# =============================================================
#   SMART TRANSACTION CATEGORIZER — PRODUCTION VERSION
# =============================================================
#   Base    : TF-IDF (char n-grams) + Logistic Regression
#   Added   : XGBoost ensemble (from new code)
#   Added   : Subcategory classification (from new code)
#   Added   : Data augmentation (from new code)
#   Added   : Explainability (from new code)
#   Kept    : 200+ Indian merchant keywords (rule-based fallback)
#   Kept    : 60+ training samples
#   Kept    : Works offline, < 1s startup
#   Kept    : Feedback loop / online learning
# =============================================================
# """

# import re
# import pickle
# import os
# import random
# import numpy as np
# from sklearn.feature_extraction.text import TfidfVectorizer
# from sklearn.linear_model import LogisticRegression
# from sklearn.pipeline import Pipeline
# from sklearn.preprocessing import LabelEncoder
# from sklearn.model_selection import train_test_split
# from sklearn.metrics import classification_report

# # XGBoost — optional, graceful fallback if not installed
# try:
#     from xgboost import XGBClassifier
#     XGBOOST_AVAILABLE = True
# except ImportError:
#     XGBOOST_AVAILABLE = False
#     XGBClassifier = None


# # ─────────────────────────────────────────────
# # CATEGORY KEYWORDS (rule-based fallback)
# # ─────────────────────────────────────────────
# CATEGORY_KEYWORDS = {
#     "Food": [
#         "swiggy","zomato","restaurant","cafe","coffee","pizza","burger",
#         "biryani","food","dining","lunch","dinner","breakfast","meal",
#         "grocery","bakery","chai","tea","juice","dominos","kfc","mcdonalds",
#         "subway","starbucks","barbeque","hotel","dhaba","bigbasket","blinkit",
#         "zepto","instamart","dunzo","haldirams","amul",
#     ],
#     "Transport": [
#         "uber","ola","rapido","auto","cab","taxi","bus","metro","train",
#         "irctc","petrol","fuel","diesel","parking","toll","flight","indigo",
#         "spicejet","airindia","redbus","makemytrip","goibibo","yatra",
#         "bpcl","hpcl","iocl","fasttag","ola electric",
#     ],
#     "Shopping": [
#         "amazon","flipkart","myntra","meesho","ajio","nykaa","snapdeal",
#         "mall","shopping","clothes","shirt","shoes","watch","bag","jewellery",
#         "fashion","dress","online","delivery","order","lenskart","pepperfry",
#         "ikea","croma","reliance digital","vijay sales",
#     ],
#     "Bills": [
#         "electricity","water","gas","internet","broadband","wifi","mobile",
#         "recharge","postpaid","prepaid","jio","airtel","bsnl","vi","vodafone",
#         "bill","utility","dth","tata sky","dish tv","sun direct","d2h",
#         "bescom","mseb","tpddl","adani electricity",
#     ],
#     "Entertainment": [
#         "netflix","prime","hotstar","spotify","youtube","movie","cinema",
#         "pvr","inox","concert","event","game","gaming","playstation",
#         "steam","subscription","ott","music","disney","zee5","sonyliv",
#         "mxplayer","jiotv","voot","marvel","bookmyshow",
#     ],
#     "Health": [
#         "hospital","clinic","doctor","medicine","pharmacy","medplus",
#         "apollo","diagnostic","lab","test","health","gym","fitness",
#         "wellness","dental","eye","insurance","mediclaim","thyrocare",
#         "lal path","dr lal","practo","tata 1mg","1mg","netmeds","cult",
#     ],
#     "Education": [
#         "school","college","university","course","udemy","coursera",
#         "books","stationery","tuition","coaching","exam","fee",
#         "study","learning","training","certification","byju","unacademy",
#         "vedantu","skill","linkedin learning","pluralsight",
#     ],
#     "Investment": [
#         "sip","mutual fund","stocks","shares","zerodha","groww","upstox",
#         "fd","fixed deposit","ppf","nps","gold","crypto","bitcoin",
#         "investment","portfolio","dividend","interest","coin","kuvera",
#         "paytm money","icicidirect","hdfc securities","angel broking",
#     ],
#     "Rent": [
#         "rent","landlord","house","flat","apartment","pg","hostel",
#         "accommodation","maintenance","society","housing","nobroker",
#         "magicbricks","99acres",
#     ],
#     "Transfer": [
#         "transfer","sent to","received from","upi","neft","rtgs",
#         "imps","wallet","paytm","phonepe","gpay","google pay",
#         "bhim","bank transfer","tez",
#     ],
#     "Salary": [
#         "salary","payroll","wages","stipend","income","credited",
#         "employer","company","payment received","ctc","bonus","hike",
#     ],
#     "Travel": [
#         "oyo","resort","booking","trip","vacation","tour","holiday",
#         "airbnb","passport","visa","travel","goibibo","hotel booking",
#         "treebo","fabhotels","zostel","backpacker",
#     ],
#     "Miscellaneous": [],
# }

# # Subcategory mapping (category → list of subcategories + keywords)
# SUBCATEGORY_MAP = {
#     "Food":          {"Dining":    ["restaurant","zomato","swiggy","cafe","dhaba"],
#                       "Grocery":   ["bigbasket","blinkit","zepto","grocery","instamart"],
#                       "Other":     []},
#     "Transport":     {"Taxi":      ["uber","ola","rapido","cab","taxi"],
#                       "Fuel":      ["petrol","diesel","fuel","bpcl","hpcl"],
#                       "Flight":    ["flight","indigo","spicejet","airindia"],
#                       "Other":     []},
#     "Shopping":      {"Electronics":["amazon","flipkart","croma","electronics"],
#                       "Fashion":   ["myntra","ajio","fashion","clothes","shoes"],
#                       "Other":     []},
#     "Entertainment": {"OTT":       ["netflix","hotstar","prime","zee5","spotify"],
#                       "Cinema":    ["pvr","inox","cinema","movie","bookmyshow"],
#                       "Other":     []},
#     "Investment":    {"SIP":       ["sip","mutual fund","groww","kuvera"],
#                       "Stocks":    ["zerodha","upstox","stocks","shares"],
#                       "FD":        ["fd","fixed deposit"],
#                       "Other":     []},
# }


# # ─────────────────────────────────────────────
# # DATA AUGMENTATION (from new code)
# # ─────────────────────────────────────────────
# _PREFIXES = ["UPI to", "Paid to", "Txn to", "IMPS to", "Transfer to", "Payment for"]
# _SUFFIXES  = ["done", "success", "ref no", "txn id", "completed"]

# def _augment_sample(desc, merchant):
#     """Generate realistic UPI-style transaction variants."""
#     variants = [(desc, merchant)]
#     for _ in range(3):
#         pfx = random.choice(_PREFIXES)
#         sfx = random.choice(_SUFFIXES)
#         variants.append((f"{pfx} {merchant} {sfx}", merchant))
#     return variants


# # ─────────────────────────────────────────────
# # TEXT PREPROCESSING
# # ─────────────────────────────────────────────
# def preprocess_text(text: str) -> str:
#     if not text:
#         return ""
#     text = text.lower()
#     text = re.sub(r"[^a-z0-9\s]", " ", text)
#     text = re.sub(r"\b\d+\b", " NUM ", text)
#     text = re.sub(r"\s+", " ", text).strip()
#     return text

# def build_combined_text(description: str, merchant_name: str = "") -> str:
#     parts = []
#     if merchant_name: parts.append(merchant_name)
#     if description:   parts.append(description)
#     return preprocess_text(" ".join(parts))


# # ─────────────────────────────────────────────
# # RULE-BASED FALLBACK
# # ─────────────────────────────────────────────
# def rule_based_category(text: str) -> tuple:
#     text_lower = text.lower()
#     for category, keywords in CATEGORY_KEYWORDS.items():
#         for kw in keywords:
#             if kw in text_lower:
#                 return category, 0.70
#     return "Miscellaneous", 0.40

# def _rule_based_subcategory(text: str, main_category: str) -> str:
#     """Rule-based subcategory from keyword map."""
#     if main_category not in SUBCATEGORY_MAP:
#         return "General"
#     text_lower = text.lower()
#     for sub, keywords in SUBCATEGORY_MAP[main_category].items():
#         if sub == "Other":
#             continue
#         for kw in keywords:
#             if kw in text_lower:
#                 return sub
#     return "Other"


# # ─────────────────────────────────────────────
# # TRAINING DATA (60+ samples, augmented)
# # ─────────────────────────────────────────────
# TRAINING_SAMPLES = [
#     # Food
#     ("Swiggy order biryani",       "Swiggy",      "Food"),
#     ("Zomato pizza delivery",      "Zomato",      "Food"),
#     ("lunch at restaurant",        "Restaurant",  "Food"),
#     ("coffee at starbucks",        "Starbucks",   "Food"),
#     ("grocery shopping bigbasket", "BigBasket",   "Food"),
#     ("kfc chicken burger meal",    "KFC",         "Food"),
#     ("dominos pizza order",        "Dominos",     "Food"),
#     ("daily chai from tapri",      "",            "Food"),
#     ("blinkit quick grocery",      "Blinkit",     "Food"),
#     ("zepto fruits delivery",      "Zepto",       "Food"),
#     # Transport
#     ("Ola cab to airport",         "Ola",         "Transport"),
#     ("Uber ride office",           "Uber",        "Transport"),
#     ("petrol bunk refill",         "BPCL",        "Transport"),
#     ("metro card recharge",        "DMRC",        "Transport"),
#     ("IRCTC train ticket booking", "IRCTC",       "Transport"),
#     ("rapido bike ride",           "Rapido",      "Transport"),
#     ("toll plaza payment",         "",            "Transport"),
#     ("IndiGo flight booking",      "IndiGo",      "Transport"),
#     ("fasttag recharge highway",   "FASTag",      "Transport"),
#     # Shopping
#     ("Amazon order earphones",     "Amazon",      "Shopping"),
#     ("Flipkart mobile phone",      "Flipkart",    "Shopping"),
#     ("Myntra dress purchase",      "Myntra",      "Shopping"),
#     ("Nykaa cosmetics order",      "Nykaa",       "Shopping"),
#     ("mall shopping weekend",      "",            "Shopping"),
#     ("croma electronics",          "Croma",       "Shopping"),
#     ("ajio fashion clothes",       "AJIO",        "Shopping"),
#     # Bills
#     ("electricity bill payment",   "BESCOM",      "Bills"),
#     ("Jio broadband internet bill","Jio",         "Bills"),
#     ("Airtel postpaid bill",       "Airtel",      "Bills"),
#     ("water bill municipality",    "",            "Bills"),
#     ("DTH Tata Sky recharge",      "Tata Sky",    "Bills"),
#     ("gas cylinder booking",       "IndianGas",   "Bills"),
#     ("vi mobile postpaid",         "Vi",          "Bills"),
#     # Entertainment
#     ("Netflix subscription monthly","Netflix",    "Entertainment"),
#     ("Spotify premium music",      "Spotify",     "Entertainment"),
#     ("PVR cinema ticket movie",    "PVR",         "Entertainment"),
#     ("Amazon Prime renewal",       "Amazon Prime","Entertainment"),
#     ("gaming steam purchase",      "Steam",       "Entertainment"),
#     ("Hotstar Disney subscription","Hotstar",     "Entertainment"),
#     ("bookmyshow event ticket",    "BookMyShow",  "Entertainment"),
#     # Health
#     ("Apollo pharmacy medicine",   "Apollo",      "Health"),
#     ("doctor consultation fee",    "",            "Health"),
#     ("gym membership monthly",     "Cult.fit",    "Health"),
#     ("diagnostic lab test",        "Thyrocare",   "Health"),
#     ("health insurance premium",   "Star Health", "Health"),
#     ("1mg medicine delivery",      "1mg",         "Health"),
#     # Education
#     ("Udemy course purchase",      "Udemy",       "Education"),
#     ("college tuition fee",        "",            "Education"),
#     ("Coursera subscription",      "Coursera",    "Education"),
#     ("byju learning app",          "Byjus",       "Education"),
#     ("books stationery purchase",  "",            "Education"),
#     # Investment
#     ("SIP mutual fund Groww",      "Groww",       "Investment"),
#     ("Zerodha stocks purchase",    "Zerodha",     "Investment"),
#     ("FD fixed deposit renewal",   "",            "Investment"),
#     ("PPF annual contribution",    "",            "Investment"),
#     ("gold purchase investment",   "",            "Investment"),
#     ("upstox shares buy",          "Upstox",      "Investment"),
#     # Rent
#     ("house rent payment landlord","",            "Rent"),
#     ("PG accommodation monthly",   "",            "Rent"),
#     ("society maintenance charge", "",            "Rent"),
#     # Transfer
#     ("UPI transfer friend",        "",            "Transfer"),
#     ("PhonePe wallet topup",       "PhonePe",     "Transfer"),
#     ("Google Pay payment",         "GPay",        "Transfer"),
#     ("bank NEFT transfer",         "",            "Transfer"),
#     # Salary
#     ("salary credited account",    "",            "Salary"),
#     ("monthly salary payment",     "",            "Salary"),
#     ("freelance payment received", "",            "Salary"),
#     ("stipend credited",           "",            "Salary"),
#     # Travel
#     ("OYO hotel booking",          "OYO",         "Travel"),
#     ("MakeMyTrip flight hotel",    "MakeMyTrip",  "Travel"),
#     ("vacation trip package",      "",            "Travel"),
#     ("Airbnb accommodation",       "Airbnb",      "Travel"),
# ]


# # ─────────────────────────────────────────────
# # MAIN CATEGORIZER CLASS
# # ─────────────────────────────────────────────
# class TransactionCategorizer:
#     MODEL_PATH           = os.path.join(os.path.dirname(__file__), "categorizer_model.pkl")
#     CONFIDENCE_THRESHOLD = 0.55

#     def __init__(self):
#         self.pipeline      = None
#         self.xgb_model     = None
#         self.label_encoder = LabelEncoder()
#         self.is_trained    = False

#     def _build_lr_pipeline(self) -> Pipeline:
#         return Pipeline([
#             ("tfidf", TfidfVectorizer(
#                 analyzer="char_wb",
#                 ngram_range=(2, 5),
#                 max_features=8000,
#                 sublinear_tf=True,
#                 min_df=1,
#             )),
#             ("clf", LogisticRegression(
#                 C=5.0, max_iter=500,
#                 solver="lbfgs",
#                 class_weight="balanced",
#             )),
#         ])

#     def _build_xgb(self):
#         if not XGBOOST_AVAILABLE:
#             return None
#         return XGBClassifier(
#             n_estimators=100, max_depth=4,
#             eval_metric="mlogloss", verbosity=0,
#         )

#     def train(self, samples: list = None) -> dict:
#         if samples is None:
#             samples = TRAINING_SAMPLES

#         # ── Augment training data ───────────────────────────
#         augmented = []
#         for desc, merch, cat in samples:
#             for aug_desc, aug_merch in _augment_sample(desc, merch):
#                 augmented.append((aug_desc, aug_merch, cat))

#         X_raw = [build_combined_text(d, m) for d, m, _ in augmented]
#         y_raw = [c for _, _, c in augmented]

#         y_encoded = self.label_encoder.fit_transform(y_raw)

#         # Stratified split
#         X_train, X_test, y_train, y_test = train_test_split(
#             X_raw, y_encoded, test_size=0.15,
#             random_state=42, stratify=y_encoded,
#         )

#         # ── Train Logistic Regression ────────────────────────
#         self.pipeline = self._build_lr_pipeline()
#         self.pipeline.fit(X_train, y_train)

#         # ── Train XGBoost (if available) ─────────────────────
#         if XGBOOST_AVAILABLE:
#             xgb_vec   = TfidfVectorizer(
#                 analyzer="char_wb", ngram_range=(2,5),
#                 max_features=5000, sublinear_tf=True,
#             )
#             X_xgb_tr  = xgb_vec.fit_transform(X_train).toarray()
#             X_xgb_te  = xgb_vec.transform(X_test).toarray()
#             self.xgb_model = self._build_xgb()
#             self.xgb_model.fit(X_xgb_tr, y_train)
#             self.xgb_vec = xgb_vec
#         else:
#             self.xgb_model = None

#         self.is_trained = True

#         # ── Evaluate ─────────────────────────────────────────
#         y_pred = self.pipeline.predict(X_test)
#         y_tl   = self.label_encoder.inverse_transform(y_test)
#         y_pl   = self.label_encoder.inverse_transform(y_pred)
#         report = classification_report(y_tl, y_pl, output_dict=True, zero_division=0)

#         self.save()
#         return {
#             "status":       "trained",
#             "samples_used": len(augmented),
#             "accuracy":     round(report.get("accuracy", 0), 3),
#             "xgboost":      XGBOOST_AVAILABLE,
#             "categories":   list(self.label_encoder.classes_),
#         }

#     def _explain(self, text: str, main_category: str) -> dict:
#         """Return top keywords that influenced this prediction."""
#         try:
#             feature_names = self.pipeline.named_steps["tfidf"].get_feature_names_out()
#             vec           = self.pipeline.named_steps["tfidf"].transform([text]).toarray()[0]
#             top_idx       = np.argsort(vec)[-5:]
#             top_words     = [feature_names[i] for i in top_idx if i < len(feature_names) and vec[i] > 0]
#             return {"top_features": top_words, "category_hint": main_category}
#         except Exception:
#             return {}

#     def predict(self, description: str, merchant_name: str = "", amount: float = None) -> dict:
#         combined_text = build_combined_text(description, merchant_name)

#         if self.is_trained and self.pipeline and combined_text:
#             try:
#                 # LR probabilities
#                 lr_proba  = self.pipeline.predict_proba([combined_text])[0]

#                 # XGBoost probabilities (if available)
#                 if self.xgb_model is not None:
#                     xgb_vec_input = self.xgb_vec.transform([combined_text]).toarray()
#                     xgb_proba     = self.xgb_model.predict_proba(xgb_vec_input)[0]
#                     # Weighted ensemble: LR 60% + XGBoost 40%
#                     proba = 0.60 * lr_proba + 0.40 * xgb_proba
#                 else:
#                     proba = lr_proba

#                 top_idx    = int(np.argmax(proba))
#                 confidence = float(proba[top_idx])
#                 predicted  = self.label_encoder.inverse_transform([top_idx])[0]

#                 all_proba = {
#                     cat: round(float(p), 3)
#                     for cat, p in zip(self.label_encoder.classes_, proba)
#                 }

#                 if confidence >= self.CONFIDENCE_THRESHOLD:
#                     subcategory  = _rule_based_subcategory(combined_text, predicted)
#                     explanation  = self._explain(combined_text, predicted)
#                     return {
#                         "category":          predicted,
#                         "subcategory":       subcategory,
#                         "confidence_score":  round(confidence, 3),
#                         "method":            "ml" if self.xgb_model is None else "ml_ensemble",
#                         "all_probabilities": all_proba,
#                         "explanation":       explanation,
#                     }

#             except Exception:
#                 pass

#         # ── Rule-based fallback ──────────────────────────────
#         category, confidence = rule_based_category(combined_text)

#         # Amount hint: very large amount unlikely Food
#         if amount and amount > 50000 and category == "Food":
#             category   = "Investment"
#             confidence = 0.50

#         subcategory = _rule_based_subcategory(combined_text, category)

#         return {
#             "category":          category,
#             "subcategory":       subcategory,
#             "confidence_score":  confidence,
#             "method":            "rule_based",
#             "all_probabilities": {},
#             "explanation":       {},
#         }

#     def add_training_sample(self, description: str, merchant_name: str, correct_category: str) -> dict:
#         """Online learning — add user correction and retrain."""
#         TRAINING_SAMPLES.append((description, merchant_name, correct_category))
#         return self.train(TRAINING_SAMPLES)

#     def save(self):
#         with open(self.MODEL_PATH, "wb") as f:
#             pickle.dump({
#                 "pipeline":      self.pipeline,
#                 "label_encoder": self.label_encoder,
#                 "xgb_model":     self.xgb_model,
#                 "xgb_vec":       getattr(self, "xgb_vec", None),
#             }, f)

#     def load(self) -> bool:
#         if os.path.exists(self.MODEL_PATH):
#             try:
#                 with open(self.MODEL_PATH, "rb") as f:
#                     data = pickle.load(f)
#                 self.pipeline      = data["pipeline"]
#                 self.label_encoder = data["label_encoder"]
#                 self.xgb_model     = data.get("xgb_model")
#                 self.xgb_vec       = data.get("xgb_vec")
#                 self.is_trained    = True
#                 return True
#             except Exception:
#                 pass
#         return False


# # ─────────────────────────────────────────────
# # SINGLETON
# # ─────────────────────────────────────────────
# categorizer = TransactionCategorizer()
# if not categorizer.load():
#     categorizer.train()


# # ─────────────────────────────────────────────
# # PUBLIC API
# # ─────────────────────────────────────────────
# def categorize_transaction(description: str, merchant_name: str = "", amount: float = None) -> dict:
#     """
#     Categorize a transaction.
#     Returns: { category, subcategory, confidence_score, method, all_probabilities, explanation }
#     """
#     return categorizer.predict(description, merchant_name, amount)


# def retrain_with_feedback(description: str, merchant_name: str, correct_category: str) -> dict:
#     """Accept user correction and retrain."""
#     return categorizer.add_training_sample(description, merchant_name, correct_category)





"""
=============================================================
  SMART TRANSACTION CATEGORIZER — PRODUCTION VERSION
=============================================================
  Base    : TF-IDF (char n-grams) + Logistic Regression
  Added   : XGBoost ensemble (from new code)
  Added   : Subcategory classification (from new code)
  Added   : Data augmentation (from new code)
  Added   : Explainability (from new code)
  Kept    : 200+ Indian merchant keywords (rule-based fallback)
  Kept    : 60+ training samples
  Kept    : Works offline, < 1s startup
  Kept    : Feedback loop / online learning
=============================================================
"""

import re
import pickle
import os
import random
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

# XGBoost — optional, graceful fallback if not installed
try:
    from xgboost import XGBClassifier
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False
    XGBClassifier = None


# ─────────────────────────────────────────────
# CATEGORY KEYWORDS (rule-based fallback)
# ─────────────────────────────────────────────
CATEGORY_KEYWORDS = {
    "Food": [
        "swiggy","zomato","restaurant","cafe","coffee","pizza","burger",
        "biryani","food","dining","lunch","dinner","breakfast","meal",
        "grocery","bakery","chai","tea","juice","dominos","kfc","mcdonalds",
        "subway","starbucks","barbeque","hotel","dhaba","bigbasket","blinkit",
        "zepto","instamart","dunzo","haldirams","amul",
    ],
    "Transport": [
        "uber","ola","rapido","auto","cab","taxi","bus","metro","train",
        "irctc","petrol","fuel","diesel","parking","toll","flight","indigo",
        "spicejet","airindia","redbus","makemytrip","goibibo","yatra",
        "bpcl","hpcl","iocl","fasttag","ola electric",
    ],
    "Shopping": [
        "amazon","flipkart","myntra","meesho","ajio","nykaa","snapdeal",
        "mall","shopping","clothes","shirt","shoes","watch","bag","jewellery",
        "fashion","dress","online","delivery","order","lenskart","pepperfry",
        "ikea","croma","reliance digital","vijay sales",
    ],
    "Bills": [
        "electricity","water","gas","internet","broadband","wifi","mobile",
        "recharge","postpaid","prepaid","jio","airtel","bsnl","vi","vodafone",
        "bill","utility","dth","tata sky","dish tv","sun direct","d2h",
        "bescom","mseb","tpddl","adani electricity",
    ],
    "Entertainment": [
        "netflix","amazon prime","prime video","hotstar","spotify","youtube",
        "movie","cinema","pvr","inox","concert","event","game","gaming",
        "playstation","steam","subscription","ott","music","disney","zee5",
        "sonyliv","mxplayer","jiotv","voot","marvel","bookmyshow","prime",
    ],
    "Health": [
        "hospital","clinic","doctor","medicine","pharmacy","medplus",
        "apollo","diagnostic","lab","test","health","gym","fitness",
        "wellness","dental","eye","insurance","mediclaim","thyrocare",
        "lal path","dr lal","practo","tata 1mg","1mg","netmeds","cult",
    ],
    "Education": [
        "school","college","university","course","udemy","coursera",
        "books","stationery","tuition","coaching","exam","fee",
        "study","learning","training","certification","byju","unacademy",
        "vedantu","skill","linkedin learning","pluralsight",
    ],
    "Investment": [
        "sip","mutual fund","stocks","shares","zerodha","groww","upstox",
        "fd","fixed deposit","ppf","nps","gold","crypto","bitcoin",
        "investment","portfolio","dividend","interest","coin","kuvera",
        "paytm money","icicidirect","hdfc securities","angel broking",
    ],
    "Rent": [
        "rent","landlord","house","flat","apartment","pg","hostel",
        "accommodation","maintenance","society","housing","nobroker",
        "magicbricks","99acres",
    ],
    "Transfer": [
        "transfer","sent to","received from","upi","neft","rtgs",
        "imps","wallet","paytm","phonepe","gpay","google pay",
        "bhim","bank transfer","tez",
    ],
    "Salary": [
        "salary","payroll","wages","stipend","income","credited",
        "employer","freelance","upwork","fiverr","consulting fee",
        "invoice paid","client payment","payment received","ctc","bonus","hike",
    ],
    "Travel": [
        "oyo","resort","booking","trip","vacation","tour","holiday",
        "airbnb","passport","visa","travel","goibibo","hotel booking",
        "treebo","fabhotels","zostel","backpacker",
    ],
    "Miscellaneous": [],
}

# Subcategory mapping (category → list of subcategories + keywords)
SUBCATEGORY_MAP = {
    "Food":          {"Dining":    ["restaurant","zomato","swiggy","cafe","dhaba"],
                      "Grocery":   ["bigbasket","blinkit","zepto","grocery","instamart"],
                      "Other":     []},
    "Transport":     {"Taxi":      ["uber","ola","rapido","cab","taxi"],
                      "Fuel":      ["petrol","diesel","fuel","bpcl","hpcl"],
                      "Flight":    ["flight","indigo","spicejet","airindia"],
                      "Other":     []},
    "Shopping":      {"Electronics":["amazon","flipkart","croma","electronics"],
                      "Fashion":   ["myntra","ajio","fashion","clothes","shoes"],
                      "Other":     []},
    "Entertainment": {"OTT":       ["netflix","hotstar","prime","zee5","spotify"],
                      "Cinema":    ["pvr","inox","cinema","movie","bookmyshow"],
                      "Other":     []},
    "Investment":    {"SIP":       ["sip","mutual fund","groww","kuvera"],
                      "Stocks":    ["zerodha","upstox","stocks","shares"],
                      "FD":        ["fd","fixed deposit"],
                      "Other":     []},
}


# ─────────────────────────────────────────────
# DATA AUGMENTATION (from new code)
# ─────────────────────────────────────────────
_PREFIXES = ["UPI to", "Paid to", "Txn to", "IMPS to", "Transfer to", "Payment for"]
_SUFFIXES  = ["done", "success", "ref no", "txn id", "completed"]

def _augment_sample(desc, merchant):
    """Generate realistic UPI-style transaction variants."""
    variants = [(desc, merchant)]
    for _ in range(3):
        pfx = random.choice(_PREFIXES)
        sfx = random.choice(_SUFFIXES)
        variants.append((f"{pfx} {merchant} {sfx}", merchant))
    return variants


# ─────────────────────────────────────────────
# TEXT PREPROCESSING
# ─────────────────────────────────────────────
def preprocess_text(text: str) -> str:
    if not text:
        return ""
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\b\d+\b", " NUM ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

def build_combined_text(description: str, merchant_name: str = "") -> str:
    parts = []
    if merchant_name: parts.append(merchant_name)
    if description:   parts.append(description)
    return preprocess_text(" ".join(parts))


# ─────────────────────────────────────────────
# RULE-BASED FALLBACK
# ─────────────────────────────────────────────
def rule_based_category(text: str) -> tuple:
    """Longest-match keyword rule — prevents short keywords overriding compound phrases."""
    text_lower = text.lower()
    best_cat   = "Miscellaneous"
    best_len   = 0
    best_conf  = 0.40
    for category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower and len(kw) > best_len:
                best_cat  = category
                best_len  = len(kw)
                best_conf = 0.70
    return best_cat, best_conf

def _rule_based_subcategory(text: str, main_category: str) -> str:
    """Rule-based subcategory from keyword map."""
    if main_category not in SUBCATEGORY_MAP:
        return "General"
    text_lower = text.lower()
    for sub, keywords in SUBCATEGORY_MAP[main_category].items():
        if sub == "Other":
            continue
        for kw in keywords:
            if kw in text_lower:
                return sub
    return "Other"


# ─────────────────────────────────────────────
# TRAINING DATA (60+ samples, augmented)
# ─────────────────────────────────────────────
TRAINING_SAMPLES = [
    # Food
    ("Swiggy order biryani",       "Swiggy",      "Food"),
    ("Zomato pizza delivery",      "Zomato",      "Food"),
    ("lunch at restaurant",        "Restaurant",  "Food"),
    ("coffee at starbucks",        "Starbucks",   "Food"),
    ("grocery shopping bigbasket", "BigBasket",   "Food"),
    ("kfc chicken burger meal",    "KFC",         "Food"),
    ("dominos pizza order",        "Dominos",     "Food"),
    ("daily chai from tapri",      "",            "Food"),
    ("blinkit quick grocery",      "Blinkit",     "Food"),
    ("zepto fruits delivery",      "Zepto",       "Food"),
    # Transport
    ("Ola cab to airport",         "Ola",         "Transport"),
    ("Uber ride office",           "Uber",        "Transport"),
    ("petrol bunk refill",         "BPCL",        "Transport"),
    ("metro card recharge",        "DMRC",        "Transport"),
    ("IRCTC train ticket booking", "IRCTC",       "Transport"),
    ("rapido bike ride",           "Rapido",      "Transport"),
    ("toll plaza payment",         "",            "Transport"),
    ("IndiGo flight booking",      "IndiGo",      "Transport"),
    ("fasttag recharge highway",   "FASTag",      "Transport"),
    # Shopping
    ("Amazon order earphones",     "Amazon",      "Shopping"),
    ("Flipkart mobile phone",      "Flipkart",    "Shopping"),
    ("Myntra dress purchase",      "Myntra",      "Shopping"),
    ("Nykaa cosmetics order",      "Nykaa",       "Shopping"),
    ("mall shopping weekend",      "",            "Shopping"),
    ("croma electronics",          "Croma",       "Shopping"),
    ("ajio fashion clothes",       "AJIO",        "Shopping"),
    # Bills
    ("electricity bill payment",   "BESCOM",      "Bills"),
    ("Jio broadband internet bill","Jio",         "Bills"),
    ("Airtel postpaid bill",       "Airtel",      "Bills"),
    ("water bill municipality",    "",            "Bills"),
    ("DTH Tata Sky recharge",      "Tata Sky",    "Bills"),
    ("gas cylinder booking",       "IndianGas",   "Bills"),
    ("vi mobile postpaid",         "Vi",          "Bills"),
    # Entertainment
    ("Netflix subscription monthly","Netflix",    "Entertainment"),
    ("Spotify premium music",      "Spotify",     "Entertainment"),
    ("PVR cinema ticket movie",    "PVR",         "Entertainment"),
    ("Amazon Prime renewal",       "Amazon Prime","Entertainment"),
    ("gaming steam purchase",      "Steam",       "Entertainment"),
    ("Hotstar Disney subscription","Hotstar",     "Entertainment"),
    ("bookmyshow event ticket",    "BookMyShow",  "Entertainment"),
    # Health
    ("Apollo pharmacy medicine",   "Apollo",      "Health"),
    ("doctor consultation fee",    "",            "Health"),
    ("gym membership monthly",     "Cult.fit",    "Health"),
    ("diagnostic lab test",        "Thyrocare",   "Health"),
    ("health insurance premium",   "Star Health", "Health"),
    ("1mg medicine delivery",      "1mg",         "Health"),
    # Education
    ("Udemy course purchase",      "Udemy",       "Education"),
    ("college tuition fee",        "",            "Education"),
    ("Coursera subscription",      "Coursera",    "Education"),
    ("byju learning app",          "Byjus",       "Education"),
    ("books stationery purchase",  "",            "Education"),
    # Investment
    ("SIP mutual fund Groww",      "Groww",       "Investment"),
    ("Zerodha stocks purchase",    "Zerodha",     "Investment"),
    ("FD fixed deposit renewal",   "",            "Investment"),
    ("PPF annual contribution",    "",            "Investment"),
    ("gold purchase investment",   "",            "Investment"),
    ("upstox shares buy",          "Upstox",      "Investment"),
    # Rent
    ("house rent payment landlord","",            "Rent"),
    ("PG accommodation monthly",   "",            "Rent"),
    ("society maintenance charge", "",            "Rent"),
    # Transfer
    ("UPI transfer friend",        "",            "Transfer"),
    ("PhonePe wallet topup",       "PhonePe",     "Transfer"),
    ("Google Pay payment",         "GPay",        "Transfer"),
    ("bank NEFT transfer",         "",            "Transfer"),
    # Salary
    ("salary credited account",    "",            "Salary"),
    ("monthly salary payment",     "",            "Salary"),
    ("freelance payment received", "",            "Salary"),
    ("stipend credited",           "",            "Salary"),
    # Travel
    ("OYO hotel booking",          "OYO",         "Travel"),
    ("MakeMyTrip flight hotel",    "MakeMyTrip",  "Travel"),
    ("vacation trip package",      "",            "Travel"),
    ("Airbnb accommodation",       "Airbnb",      "Travel"),

    # Entertainment — compound phrases (fix amazon prime → Entertainment)
    ("Amazon Prime renewal",       "Amazon Prime","Entertainment"),
    ("prime video subscription",   "Amazon",      "Entertainment"),
    ("amazon prime monthly",       "Amazon",      "Entertainment"),

    # Health — insurance and pharmacy (fix apollo → Health, insurance → Health)
    ("health insurance premium",   "Star Health", "Health"),
    ("apollo pharmacy medicine",   "Apollo Pharmacy","Health"),
    ("mediclaim renewal policy",   "",            "Health"),

    # Salary — freelance payments
    ("freelance payment received", "Upwork",      "Salary"),
    ("consulting fee client",      "",            "Salary"),
    ("invoice paid freelancer",    "",            "Salary"),
]


# ─────────────────────────────────────────────
# MAIN CATEGORIZER CLASS
# ─────────────────────────────────────────────
class TransactionCategorizer:
    MODEL_PATH           = os.path.join(os.path.dirname(__file__), "categorizer_model.pkl")
    CONFIDENCE_THRESHOLD = 0.55

    def __init__(self):
        self.pipeline      = None
        self.xgb_model     = None
        self.label_encoder = LabelEncoder()
        self.is_trained    = False

    def _build_lr_pipeline(self) -> Pipeline:
        return Pipeline([
            ("tfidf", TfidfVectorizer(
                analyzer="char_wb",
                ngram_range=(2, 5),
                max_features=8000,
                sublinear_tf=True,
                min_df=1,
            )),
            ("clf", LogisticRegression(
                C=5.0, max_iter=500,
                solver="lbfgs",
                class_weight="balanced",
            )),
        ])

    def _build_xgb(self):
        if not XGBOOST_AVAILABLE:
            return None
        return XGBClassifier(
            n_estimators=100, max_depth=4,
            eval_metric="mlogloss", verbosity=0,
        )

    def train(self, samples: list = None) -> dict:
        if samples is None:
            samples = TRAINING_SAMPLES

        # ── Augment training data ───────────────────────────
        augmented = []
        for desc, merch, cat in samples:
            for aug_desc, aug_merch in _augment_sample(desc, merch):
                augmented.append((aug_desc, aug_merch, cat))

        X_raw = [build_combined_text(d, m) for d, m, _ in augmented]
        y_raw = [c for _, _, c in augmented]

        y_encoded = self.label_encoder.fit_transform(y_raw)

        # Stratified split
        X_train, X_test, y_train, y_test = train_test_split(
            X_raw, y_encoded, test_size=0.15,
            random_state=42, stratify=y_encoded,
        )

        # ── Train Logistic Regression ────────────────────────
        self.pipeline = self._build_lr_pipeline()
        self.pipeline.fit(X_train, y_train)

        # ── Train XGBoost (if available) ─────────────────────
        if XGBOOST_AVAILABLE:
            xgb_vec   = TfidfVectorizer(
                analyzer="char_wb", ngram_range=(2,5),
                max_features=5000, sublinear_tf=True,
            )
            X_xgb_tr  = xgb_vec.fit_transform(X_train).toarray()
            X_xgb_te  = xgb_vec.transform(X_test).toarray()
            self.xgb_model = self._build_xgb()
            self.xgb_model.fit(X_xgb_tr, y_train)
            self.xgb_vec = xgb_vec
        else:
            self.xgb_model = None

        self.is_trained = True

        # ── Evaluate ─────────────────────────────────────────
        y_pred = self.pipeline.predict(X_test)
        y_tl   = self.label_encoder.inverse_transform(y_test)
        y_pl   = self.label_encoder.inverse_transform(y_pred)
        report = classification_report(y_tl, y_pl, output_dict=True, zero_division=0)

        self.save()
        return {
            "status":       "trained",
            "samples_used": len(augmented),
            "accuracy":     round(report.get("accuracy", 0), 3),
            "xgboost":      XGBOOST_AVAILABLE,
            "categories":   list(self.label_encoder.classes_),
        }

    def _explain(self, text: str, main_category: str) -> dict:
        """Return top keywords that influenced this prediction."""
        try:
            feature_names = self.pipeline.named_steps["tfidf"].get_feature_names_out()
            vec           = self.pipeline.named_steps["tfidf"].transform([text]).toarray()[0]
            top_idx       = np.argsort(vec)[-5:]
            top_words     = [feature_names[i] for i in top_idx if i < len(feature_names) and vec[i] > 0]
            return {"top_features": top_words, "category_hint": main_category}
        except Exception:
            return {}

    def predict(self, description: str, merchant_name: str = "", amount: float = None) -> dict:
        combined_text = build_combined_text(description, merchant_name)

        if self.is_trained and self.pipeline and combined_text:
            try:
                # LR probabilities
                lr_proba  = self.pipeline.predict_proba([combined_text])[0]

                # XGBoost probabilities (if available)
                if self.xgb_model is not None:
                    xgb_vec_input = self.xgb_vec.transform([combined_text]).toarray()
                    xgb_proba     = self.xgb_model.predict_proba(xgb_vec_input)[0]
                    # Weighted ensemble: LR 60% + XGBoost 40%
                    proba = 0.60 * lr_proba + 0.40 * xgb_proba
                else:
                    proba = lr_proba

                top_idx    = int(np.argmax(proba))
                confidence = float(proba[top_idx])
                predicted  = self.label_encoder.inverse_transform([top_idx])[0]

                all_proba = {
                    cat: round(float(p), 3)
                    for cat, p in zip(self.label_encoder.classes_, proba)
                }

                if confidence >= self.CONFIDENCE_THRESHOLD:
                    subcategory  = _rule_based_subcategory(combined_text, predicted)
                    explanation  = self._explain(combined_text, predicted)
                    return {
                        "category":          predicted,
                        "subcategory":       subcategory,
                        "confidence_score":  round(confidence, 3),
                        "method":            "ml" if self.xgb_model is None else "ml_ensemble",
                        "all_probabilities": all_proba,
                        "explanation":       explanation,
                    }

            except Exception:
                pass

        # ── Rule-based fallback ──────────────────────────────
        category, confidence = rule_based_category(combined_text)

        # Amount hint: very large amount unlikely Food
        if amount and amount > 50000 and category == "Food":
            category   = "Investment"
            confidence = 0.50

        subcategory = _rule_based_subcategory(combined_text, category)

        return {
            "category":          category,
            "subcategory":       subcategory,
            "confidence_score":  confidence,
            "method":            "rule_based",
            "all_probabilities": {},
            "explanation":       {},
        }

    def add_training_sample(self, description: str, merchant_name: str, correct_category: str) -> dict:
        """Online learning — add user correction and retrain."""
        TRAINING_SAMPLES.append((description, merchant_name, correct_category))
        return self.train(TRAINING_SAMPLES)

    def save(self):
        with open(self.MODEL_PATH, "wb") as f:
            pickle.dump({
                "pipeline":      self.pipeline,
                "label_encoder": self.label_encoder,
                "xgb_model":     self.xgb_model,
                "xgb_vec":       getattr(self, "xgb_vec", None),
            }, f)

    def load(self) -> bool:
        if os.path.exists(self.MODEL_PATH):
            try:
                with open(self.MODEL_PATH, "rb") as f:
                    data = pickle.load(f)
                self.pipeline      = data["pipeline"]
                self.label_encoder = data["label_encoder"]
                self.xgb_model     = data.get("xgb_model")
                self.xgb_vec       = data.get("xgb_vec")
                self.is_trained    = True
                return True
            except Exception:
                pass
        return False


# ─────────────────────────────────────────────
# SINGLETON
# ─────────────────────────────────────────────
categorizer = TransactionCategorizer()
if not categorizer.load():
    categorizer.train()


# ─────────────────────────────────────────────
# PUBLIC API
# ─────────────────────────────────────────────
def categorize_transaction(description: str, merchant_name: str = "", amount: float = None) -> dict:
    """
    Categorize a transaction.
    Returns: { category, subcategory, confidence_score, method, all_probabilities, explanation }
    """
    return categorizer.predict(description, merchant_name, amount)


def retrain_with_feedback(description: str, merchant_name: str, correct_category: str) -> dict:
    """Accept user correction and retrain."""
    return categorizer.add_training_sample(description, merchant_name, correct_category)