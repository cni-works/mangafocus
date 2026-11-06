<?php
/** Publication/access contract; legacy test filename retained. Local WP services, no site/DB writes. */
define('ABSPATH',__DIR__);
$GLOBALS['options']=array();$GLOBALS['meta']=array();$GLOBALS['actions']=array();$GLOBALS['filters']=array();$GLOBALS['admin']=true;$GLOBALS['edit']=true;$GLOBALS['revision']=false;$GLOBALS['autosave']=false;$GLOBALS['override']=null;$GLOBALS['writes']=0;$GLOBALS['nonce_action']='amv_public_policy';
class WP_Error{public $code,$data;function __construct($c,$m,$d){$this->code=$c;$this->data=$d;}}
class WP_REST_Server{const READABLE='GET';}
class WP_REST_Response{public $data,$headers=array();function __construct($d){$this->data=$d;}function header($k,$v){$this->headers[$k]=$v;}function get_headers(){return $this->headers;}}
function add_action($h,$cb,$p=10,$n=1){$GLOBALS['actions'][$h][]=$cb;}
function add_filter($h,$cb,$p=10,$n=1){$GLOBALS['filters'][$h][]=$cb;}
function apply_filters($h,$value,$id){return is_callable($GLOBALS['override'])?call_user_func($GLOBALS['override'],$value,$id):$value;}
function absint($v){return abs((int)$v);}
function get_post($id){return $GLOBALS['posts'][$id]??null;}
function get_option($k,$d=false){return $GLOBALS['options'][$k]??$d;}
function update_option($k,$v,$a=null){$GLOBALS['writes']++;$GLOBALS['options'][$k]=$v;}
function get_post_meta($id,$k,$single=true){return $GLOBALS['meta'][$id][$k]??'';}
function update_post_meta($id,$k,$v){$GLOBALS['writes']++;$GLOBALS['meta'][$id][$k]=$v;}
function delete_post_meta($id,$k){$GLOBALS['writes']++;unset($GLOBALS['meta'][$id][$k]);}
function current_user_can($cap,$id=null){return $cap==='manage_options'?$GLOBALS['admin']:$GLOBALS['edit'];}
function wp_is_post_revision($id){return $GLOBALS['revision'];}
function wp_is_post_autosave($id){return $GLOBALS['autosave'];}
function wp_unslash($s){return $s;}
function wp_verify_nonce($n,$action){return $n==='fixture-nonce'&&$action===$GLOBALS['nonce_action'];}
function wp_generate_uuid4(){return '00000000-0000-4000-8000-000000000001';}
function ai_manga_viewer_render_library_viewer($id,$key){return '<div>Approved public renderer output</div>';}
function ai_manga_viewer_library_cover_url($id,$size){return '';}
function get_the_title($id){return 'Public comic';}
function wp_strip_all_tags($v){return strip_tags($v);}
function register_rest_route(){}
function __($s,$d=''){return $s;}
function esc_html__($s,$d=''){return htmlspecialchars($s,ENT_QUOTES);}
function esc_html_e($s,$d=''){echo esc_html__($s,$d);}
function esc_url($s){return htmlspecialchars($s,ENT_QUOTES);}
function admin_url($path){return 'https://example.test/wp-admin/'.$path;}
function ai_manga_viewer_settings_url(){return admin_url('edit.php?post_type=amv_viewer&page=ai-manga-viewer-settings');}
function wp_nonce_field($a,$name){echo '<input name="'.htmlspecialchars($name).'" value="fixture">';}
function checked($a,$b,$echo=true){$s=$a===$b?' checked="checked"':'';if($echo)echo $s;return $s;}
function submit_button($label){echo '<button>'.htmlspecialchars($label).'</button>';}
require getenv('MANGAFOCUS_PHASE2_FREE').'/includes/library-runtime.php';
$n=0;function check($v){global $n;if(!$v)throw new RuntimeException('Approval assertion '.($n+1));$n++;}
$post=(object)array('ID'=>6,'post_type'=>'amv_viewer','post_status'=>'publish','post_password'=>'','post_content'=>'fixture confidential block data','post_modified_gmt'=>'2026-11-01 01:00:00');$GLOBALS['posts'][6]=$post;
check(ai_manga_viewer_library_is_publicly_readable(6));
foreach(array('closed','restricted','reviewed-public','unknown') as $policy){$GLOBALS['options']['amv_library_public_policy']=$policy;check(ai_manga_viewer_library_is_publicly_readable(6));}
$GLOBALS['meta'][6]['_amv_public_loading_approval']='obsolete-private-stamp';
foreach(array('ai_manga_viewer_library_public_policy_save','ai_manga_viewer_library_save_public_approval','ai_manga_viewer_library_public_metabox','ai_manga_viewer_library_public_stamp','ai_manga_viewer_library_admin_approved') as $fn)check(!function_exists($fn));
foreach(array('admin_post_amv_library_public_policy','wp_after_insert_post','add_meta_boxes_amv_viewer','ai_manga_viewer_settings_sections') as $hook)check(empty($GLOBALS['actions'][$hook]));
foreach(array('draft','private','trash','future','pending') as $status){$post->post_status=$status;check(!ai_manga_viewer_library_is_publicly_readable(6));}$post->post_status='publish';
$post->post_password='fixture';check(!ai_manga_viewer_library_is_publicly_readable(6));$post->post_password='';
foreach(array('post_content','post_modified_gmt','post_title','post_excerpt') as $field){$post->$field=(string)($post->$field??'').' edited';check(ai_manga_viewer_library_is_publicly_readable(6));}
check($GLOBALS['writes']===0&&$GLOBALS['meta'][6]['_amv_public_loading_approval']==='obsolete-private-stamp');
$GLOBALS['override']=static function(){return false;};check(!ai_manga_viewer_library_is_publicly_readable(6));$GLOBALS['override']=null;
$GLOBALS['options']['amv_library_public_policy']='restricted';check(ai_manga_viewer_library_is_publicly_readable(6));
$GLOBALS['override']=static function(){return true;};check(ai_manga_viewer_library_is_publicly_readable(6));$post->post_password='fixture';check(!ai_manga_viewer_library_is_publicly_readable(6));$post->post_password='';$GLOBALS['override']=null;$GLOBALS['options']['amv_library_public_policy']='reviewed-public';
$response=ai_manga_viewer_get_public_library_viewer(array('id'=>6));check($response instanceof WP_REST_Response);check(array_keys($response->data)===array('schemaVersion','id','title','coverUrl','html'));
$cache=$GLOBALS['filters']['rest_post_dispatch'][0];$response->header('Vary','Accept-Encoding');$response=$cache($response,null,new class{function get_route(){return '/ai-manga-viewer/v1/library-viewers/6';}});check(strpos($response->headers['Cache-Control'],'no-store')!==false);check(strpos($response->headers['Vary'],'Cookie')!==false&&strpos($response->headers['Vary'],'Origin')!==false&&strpos($response->headers['Vary'],'Accept-Encoding')!==false);
// No UI or approval-save hook remains; stale POST consent cannot alter data.
$_POST=array('_amv_public_comic_nonce'=>'fixture-nonce','amv_public_comic'=>'1');
check(empty($GLOBALS['actions']['wp_after_insert_post'])&&empty($GLOBALS['actions']['save_post_amv_viewer']));
check($GLOBALS['writes']===0);
$post->post_status='private';check(ai_manga_viewer_get_public_library_viewer(array('id'=>6)) instanceof WP_Error);$post->post_status='publish';check(ai_manga_viewer_get_public_library_viewer(array('id'=>6)) instanceof WP_REST_Response);
check(strpos(json_encode($response->data),'obsolete-private-stamp')===false&&strpos(json_encode($response->data),'fixture confidential')===false);
echo "PASS $n publication/security assertions; real predicate, retired UI/save hooks, local WP services; no site or DB.\n";
