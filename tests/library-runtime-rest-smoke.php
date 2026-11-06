<?php
/** Local API access/response doubles, not a real WordPress REST integration. */
define('ABSPATH', __DIR__);
class WP_REST_Server { const READABLE='GET'; }
class WP_Error { public $code,$message,$data; function __construct($c,$m,$d){$this->code=$c;$this->message=$m;$this->data=$d;} }
class WP_REST_Response { public $data,$headers=[]; function __construct($d){$this->data=$d;} function header($k,$v){$this->headers[$k]=$v;} }
function absint($v){return abs((int)$v);}
function add_action($a,$b){}
function add_filter($a,$b,$p=10,$n=1){}
function register_rest_route($n,$p,$args){$GLOBALS['route']=$args;}
function get_post($id){return $GLOBALS['post'] ?? null;}
function apply_filters($name,$value,$id){return $GLOBALS['access_override'] ?? $value;}
function wp_strip_all_tags($s){return strip_tags($s);}
function get_the_title($id){return '<b>Public comic</b>';}
function ai_manga_viewer_library_cover_url($id,$size){return false;}
function wp_generate_uuid4(){return '00000000-0000-4000-8000-'.str_pad((string)++$GLOBALS['runtime_serial'],12,'0',STR_PAD_LEFT);}
function ai_manga_viewer_render_library_viewer($id,$instance=''){$GLOBALS['runtime_instances'][]=$instance;return '<div class="amv-reader">public markup</div>';}
require dirname(__DIR__).'/includes/library-runtime.php';
$n=0; $GLOBALS['runtime_serial']=0; $GLOBALS['runtime_instances']=[];
function check($v){global $n; if(!$v)throw new Exception('API assertion '.($n+1));$n++;}
$GLOBALS['post']=(object)['ID'=>6,'post_type'=>'amv_viewer','post_status'=>'publish','post_password'=>''];
check(ai_manga_viewer_library_is_publicly_readable(6));
$GLOBALS['access_override']=false;check(!ai_manga_viewer_library_is_publicly_readable(6));
$GLOBALS['access_override']=true;
check(ai_manga_viewer_library_is_publicly_readable(6));
foreach(['draft','private','pending','future','trash','auto-draft'] as $status){$GLOBALS['post']->post_status=$status;check(!ai_manga_viewer_library_is_publicly_readable(6));check(ai_manga_viewer_get_public_library_viewer(['id'=>6]) instanceof WP_Error);}
$GLOBALS['post']->post_status='publish';$GLOBALS['post']->post_password='protected';check(!ai_manga_viewer_library_is_publicly_readable(6));
$GLOBALS['post']->post_password='';$GLOBALS['post']->post_type='post';check(!ai_manga_viewer_library_is_publicly_readable(6));
$GLOBALS['post']->post_type='amv_viewer';$GLOBALS['access_override']=1;check(!ai_manga_viewer_library_is_publicly_readable(6));
$GLOBALS['access_override']=false;check(!ai_manga_viewer_library_is_publicly_readable(6));
$GLOBALS['access_override']=true;$v=ai_manga_viewer_get_public_library_viewer(['id'=>6]);check($v instanceof WP_REST_Response);check(array_keys($v->data)===['schemaVersion','id','title','coverUrl','html']);check($v->data['title']==='Public comic');check($v->headers['Cache-Control']==='no-store, private');
ai_manga_viewer_register_library_runtime_route();$validate=$GLOBALS['route']['args']['id']['validate_callback'];
foreach(['0','-1','1e3','1.1','bad',[],str_repeat('9',40)] as $id)check(!$validate($id));check($validate('6'));
$GLOBALS['post']=null;check(!ai_manga_viewer_library_is_publicly_readable(6));
ai_manga_viewer_get_public_library_viewer(['id'=>6]); // Missing post is still rejected before generating an instance.
check(count($GLOBALS['runtime_instances'])===1);
$GLOBALS['post']=(object)['ID'=>6,'post_type'=>'amv_viewer','post_status'=>'publish','post_password'=>''];
ai_manga_viewer_get_public_library_viewer(['id'=>6]);check(count(array_unique($GLOBALS['runtime_instances']))===2);
echo "PASS $n public-library API assertions (local doubles).\n";
