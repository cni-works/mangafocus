<?php
/** Local markup only; no WordPress/SDK/DB bootstrap. */
ob_start(); require getenv( 'MANGAFOCUS_RENDER_TEST_BOOTSTRAP' ) ?: __DIR__ . '/render-smoke.php'; ob_end_clean();
$GLOBALS['test_block_class'] = 'wp-block-ai-manga-viewer-viewer';
$c = json_decode( $argv[1] ?? '{}', true, 512, JSON_THROW_ON_ERROR ); $pages = array();
for ( $i = 0; $i < 5; $i++ ) {
 $wide = ! empty( $c['landscape'] ); $w = ! empty( $c['small'] ) ? 200 : ( $wide ? 1200 : 600 ); $h = ! empty( $c['small'] ) ? 300 : ( $wide ? 600 : 900 );
 $pages[] = array( 'id'=>0, 'url'=>'https://example.test/compact-'.$i.'.svg', 'alt'=>'Fixture', 'width'=>$w, 'height'=>$h, 'pageKey'=>'compact-page-'.$i, 'focusAreas'=>array(array('id'=>'area-'.$i,'x'=>50,'y'=>50,'width'=>60,'height'=>60,'zoom'=>100)), 'cta'=>array('enabled'=>true,'ctaKey'=>'compact-cta-'.$i,'type'=>'text','label'=>'CTA','url'=>'https://example.test/cta','freePosition'=>true,'x'=>12,'y'=>50,'width'=>20) );
}
if(!empty($c['unknown']))foreach($pages as &$item){unset($item['width'],$item['height']);}unset($item);
$a = array( 'pages'=>$pages,'viewerKey'=>'compact-viewer','enableInline'=>!isset($c['inline'])||$c['inline'],'enableFullscreen'=>true,'fullscreenStartAtCurrent'=>true,'fullscreenReadingMode'=>!empty($c['vertical'])?'vertical':'paged','focusReader'=>true,'enableZoom'=>!empty($c['zoom']),'zoomControlsPosition'=>$c['side']??'bottom','enableAnimation'=>!empty($c['animation']),'binding'=>$c['binding']??'rtl','pageLayout'=>$c['layout']??'single','singleFirstPage'=>false,'spreadReadingMode'=>$c['spreadMode']??'overview','maxWidth'=>$c['maxWidth']??650,'enableEdgeClick'=>$c['edge']??true,'showGuideArrowOnAllPages'=>$c['guide']??true,'showPageNumbers'=>$c['numbers']??true );
if(!empty($c['legacy']))unset($a['enableInline']);
echo '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body>';
foreach(array('compact-a','compact-b') as $id){$a['instanceKey']=$id;echo '<section id="'.$id.'">'.ai_manga_viewer_render_viewer($a).'</section>';}
echo '</body>';
