<?php
/*
 * Copyright (c) 2016 The MITRE Corporation
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

namespace MediaWiki\Extension\CommentStreams;

use Article;
use DatabaseUpdater;
use MediaWiki;
use OutputPage;
use Parser;
use PPFrame;
use SearchResult;
use Skin;
use SMW;
use SMW\DIWikiPage;
use SpecialSearch;
use Status;
use Title;
use User;
use WebRequest;
use WikiPage;

class CommentStreamsHooks {

	/**
	 * Implements ParserFirstCallInit hook.
	 * See https://www.mediawiki.org/wiki/Manual:Hooks/ParserFirstCallInit
	 * Adds comment-streams, no-comment-streams, and
	 * comment-streams-initially-collapsed magic words.
	 *
	 * @param Parser $parser the parser
	 * @return bool continue checking hooks
	 */
	public static function onParserSetup( Parser $parser ) {
		$parser->setHook( 'comment-streams',
			'MediaWiki\Extension\CommentStreams\CommentStreamsHooks::enableCommentStreams' );
		$parser->setHook( 'no-comment-streams',
			'MediaWiki\Extension\CommentStreams\CommentStreamsHooks::disableCommentStreams' );
		return true;
	}

	/**
	 * Implements tag function, <comment-streams/>, which enables
	 * CommentStreams on a page.
	 *
	 * @param string $input input between the tags (ignored)
	 * @param array $args tag arguments
	 * @param Parser $parser the parser
	 * @param PPFrame $frame the parent frame
	 * @return string to replace tag with
	 */
	public static function enableCommentStreams(
		$input,
		array $args,
		Parser $parser,
		PPFrame $frame
	) {
		$parser->getOutput()->updateCacheExpiry( 0 );
		$cs = CommentStreams::singleton();
		$cs->enableCommentsOnPage();
		if ( isset( $args['id'] ) ) {
			$ret = '<div class="cs-comments" id="csc_' . md5( $args['id'] ) . '"></div>';
		} elseif ( isset( $args['location'] ) && $args['location'] === 'footer' ) {
			$ret = '';
		} else {
			$ret = '<div class="cs-comments" id="cs-comments"></div>';
		}
		return $ret;
	}

	/**
	 * Implements tag function, <no-comment-streams/>, which disables
	 * CommentStreams on a page.
	 *
	 * @param string $input input between the tags (ignored)
	 * @param array $args tag arguments
	 * @param Parser $parser the parser
	 * @param PPFrame $frame the parent frame
	 * @return string to replace tag with
	 */
	public static function disableCommentStreams( $input, array $args,
		Parser $parser, PPFrame $frame ) {
		$parser->getOutput()->updateCacheExpiry( 0 );
		$cs = CommentStreams::singleton();
		$cs->disableCommentsOnPage();
		return "";
	}

	/**
	 * Implements BeforePageDisplay hook.
	 * See https://www.mediawiki.org/wiki/Manual:Hooks/BeforePageDisplay
	 * Gets comments for page and initializes variables to be passed to JavaScript.
	 *
	 * @param OutputPage $output OutputPage object
	 * @param Skin $skin Skin object that will be used to generate the page
	 * @return bool continue checking hooks
	 */
	public static function addCommentsAndInitializeJS(
		OutputPage $output,
		Skin $skin
	) {
		$cs = CommentStreams::singleton();
		$cs->init( $output );
		return true;
	}

}
