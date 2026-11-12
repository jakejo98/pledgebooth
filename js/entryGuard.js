// 하위 페이지(pages/*.html)에 주소창 URL 직접 입력·북마크·외부 링크로 들어오면 index로 돌려보낸다.
// 앱 내부 이동(같은 origin에서 넘어온 경우)만 허용. 렌더 전에 실행되도록 <head>에서 일반 스크립트로 로드할 것.
(function(){
  var indexUrl = new URL('../index.html', window.location.href).toString();

  // 비밀번호 재설정 메일 링크(oobCode 포함)는 외부에서 들어오는 정상 경로이므로 예외
  var params = new URLSearchParams(window.location.search);
  if(/reset-password\.html$/.test(window.location.pathname) && params.get('oobCode')){
    return;
  }

  var fromSameOrigin = false;
  try{
    fromSameOrigin = !!document.referrer && new URL(document.referrer).origin === window.location.origin;
  }catch(e){}

  if(!fromSameOrigin){
    window.location.replace(indexUrl);
  }
})();
