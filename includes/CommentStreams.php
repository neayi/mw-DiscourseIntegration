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

use ExtensionRegistry;
use MWNamespace;

class CommentStreams {

	// CommentStreams singleton instance
	private static $instance = null;

	const COMMENTS_ENABLED = 1;
	const COMMENTS_DISABLED = -1;
	const COMMENTS_INHERITED = 0;

	// no CommentStreams flag
	private $areCommentsEnabled = self::COMMENTS_INHERITED;

	// true if enabled due to wgCommentStreamsAllowedNamespaces
	private $areNamespaceEnabled = false;

	/**
	 * create a CommentStreams singleton instance
	 *
	 * @return CommentStreams a singleton CommentStreams instance
	 */
	public static function singleton() : self {
		if ( self::$instance === null ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * enables the display of comments on the current page
	 */
	public function enableCommentsOnPage() {
		$this->areCommentsEnabled = self::COMMENTS_ENABLED;
	}

	/**
	 * disables the display of comments on the current page
	 */
	public function disableCommentsOnPage() {
		$this->areCommentsEnabled = self::COMMENTS_DISABLED;
	}

	/**
	 * initializes the display of comments
	 *
	 * @param OutputPage $output OutputPage object
	 */
	public function init( $output ) {
		if ( $this->checkDisplayComments( $output ) ) {

			$this->initJS( $output );
		}
	}

	/**
	 * checks to see if comments should be displayed on this page
	 *
	 * @param OutputPage $output the OutputPage object
	 * @return bool true if comments should be displayed on this page
	 */
	private function checkDisplayComments( $output ) {
		// don't display comments on this page if they are explicitly disabled
		if ( $this->areCommentsEnabled === self::COMMENTS_DISABLED ) {
			return false;
		}

		// don't display comments on any page action other than view action
		if ( \Action::getActionName( $output->getContext() ) !== "view" ) {
			return false;
		}

		// if $wgCommentStreamsAllowedNamespaces is not set, display comments
		// in all content namespaces and if set to -1, don't display comments
		$config = $output->getConfig();
		$csAllowedNamespaces = $config->get( 'CommentStreamsAllowedNamespaces' );
		if ( $csAllowedNamespaces === null ) {
			$csAllowedNamespaces = $config->get( 'ContentNamespaces' );
			$this->areNamespaceEnabled = true;
		} elseif ( $csAllowedNamespaces === self::COMMENTS_DISABLED ) {
			return false;
		} elseif ( !is_array( $csAllowedNamespaces ) ) {
			$csAllowedNamespaces = [ $csAllowedNamespaces ];
		}

		$title = $output->getTitle();
		$namespace = $title->getNamespace();

		// don't display comments on pages that do not exist
		if ( !$title->exists() ) {
			return false;
		}

		// don't display comments on redirect pages
		if ( $title->isRedirect() ) {
			return false;
		}

		// display comments on this page if they are explicitly enabled
		if ( $this->areCommentsEnabled === self::COMMENTS_ENABLED ) {
			return true;
		}

		// don't display comments in a talk namespace
		if ( $title->isTalkPage() ) {
				return false;
		} elseif ( !in_array( $namespace, $csAllowedNamespaces ) ) {
			// only display comments in subject namespaces in the list of allowed
			// namespaces
			return false;
		}

		return true;
	}

	/**
	 * initialize JavaScript
	 *
	 * @param OutputPage $output the OutputPage object
	 */
	private function initJS( $output ) {
		// determine if comments should be initially collapsed or expanded
		// if the namespace is a talk namespace, use state of its subject namespace
		$title = $output->getTitle();
		$namespace = $title->getNamespace();
		if ( $title->isTalkPage() ) {
			$namespace = MWNamespace::getSubject( $namespace );
		}

		$commentStreamsParams = [
			'moderatorEdit' => in_array( 'cs-moderator-edit',
				$output->getUser()->getRights() ),
			'moderatorDelete' => in_array( 'cs-moderator-delete',
				$output->getUser()->getRights() ),
			'areNamespaceEnabled' => $this->areNamespaceEnabled,
			'enableWatchlist' =>
				ExtensionRegistry::getInstance()->isLoaded( 'Echo' ) ? 1 : 0
		];

		// Neayi: $wgCommentStreamsEnableWatchlist was not tested
		$commentStreamsParams['enableWatchlist'] = $GLOBALS['wgCommentStreamsEnableWatchlist']
													&& ExtensionRegistry::getInstance()->isLoaded( 'Echo' ) ? 1 : 0;


		$commentStreamsParams['discourseTopicId'] = $this->getDiscourseTopicId( $title );
		$commentStreamsParams['DiscourseURL'] = $GLOBALS['wgDiscourseURL'];

		// End Neayi

		$output->addJsConfigVars( 'CommentStreams', $commentStreamsParams );
		$output->addModules( 'ext.CommentStreams' );
		if ( ExtensionRegistry::getInstance()->isLoaded( 'VEForAll' ) ) {
			$output->addModules( 'ext.veforall.main' );
		}
	}

	/**
	 * Finds the discourse topic for the current URL
	 */
	private function getDiscourseTopicId($wikiTitle)
	{
		$pageURL = $wikiTitle->getFullURL('', false, 'https://');

		$api = $this->getDiscourseAPI();

        $r = $api->getPostsByEmbeddedURL($pageURL);

        if (empty($r->apiresult) || !isset($r->apiresult->topic_id))
            return false;

        return $r->apiresult->topic_id;
	}

	private function getDiscourseAPI()
	{
		if ( empty($GLOBALS['wgDiscourseAPIKey']) || empty($GLOBALS['wgDiscourseHost']) )
			throw new \MWException("\nPlease define \$wgDiscourseAPIKey and \$wgDiscourseHost\n", 1);

		if ($GLOBALS['env'] == 'dev')
		{
			return new \DiscourseAPI($GLOBALS['wgDiscourseHost'], $GLOBALS['wgDiscourseAPIKey'],
									'http', '', '', true);
		}
		else
		{
			return new \DiscourseAPI($GLOBALS['wgDiscourseHost'], $GLOBALS['wgDiscourseAPIKey'],
									'https', '', '', false);
		}
	}

}
