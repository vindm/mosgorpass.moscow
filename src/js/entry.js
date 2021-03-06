require('./lib/pager');

$(function() {
    var $pager = $('.pager'),
        $video = $('.pager__page').eq(0),
        $screens = $('.screens'),
        video = $video.data('vide').getVideoObject(),
        pager;

    $pager.pager();
    pager = $pager.data('pager');

    $('.screens__nav_dir_next').on('tap', function() {
        pager.step(1);
    });
    $('.screens__nav_dir_prev').on('tap', function() {
        pager.step(-1);
    });

    $pager
        .on('change_start', function() {
            video.pause();
        })
        .on('change_done', function(e, data) {
            if (data.current.$elem.is($video)) {
                video.play();
            }
        })
        .on('change_step', function(e, data) {
            pager.disable();

            $screens
                .removeClass('screens_step_' + data.prev)
                .addClass('screens_step_' + data.current);

            setTimeout(function() {
                pager.enable();
            }, data.isFirst || data.isLast ? 1100 : 900);
        });

});
